import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { config } from './config';
import { AppError } from './errors';

export interface EventRecord {
  id: number;
  slug: string;
  name: string;
  event_date: string;
  capacity: number;
  status: 'open' | 'closed';
}

export interface StudentRecord {
  id: number;
  student_no: string;
  display_name: string;
}

export interface ApplicationRecord {
  id: number;
  student_no: string;
  submitted_name: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  reviewer_username?: string | null;
}

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
});

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

const databaseNameFromUrl = (databaseUrl: string) => {
  const parsed = new URL(databaseUrl);
  const name = parsed.pathname.replace(/^\//, '');
  if (!name) throw new Error('DATABASE_URL must include a database name.');
  return decodeURIComponent(name);
};

const runQuery = async <T extends QueryResultRow>(text: string, values: unknown[] = []) => {
  return pool.query<T>(text, values);
};

export async function initializeDatabase() {
  const databaseName = databaseNameFromUrl(config.databaseUrl);
  const adminPool = new Pool({ connectionString: config.databaseAdminUrl, max: 1 });

  try {
    const exists = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (exists.rowCount === 0) {
      await adminPool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    }
  } catch (error) {
    console.warn('Database auto-creation skipped:', error instanceof Error ? error.message : error);
  } finally {
    await adminPool.end();
  }

  const migrationPath = path.resolve(process.cwd(), 'server/migrations/001_init.sql');
  const migration = await fs.readFile(migrationPath, 'utf8');
  await pool.query(migration);
  await seedDefaults();
}

async function seedDefaults() {
  await runQuery(
    `INSERT INTO events (slug, name, event_date, capacity, status)
     VALUES ($1, $2, $3, $4, 'open')
     ON CONFLICT (slug) DO UPDATE
     SET name = EXCLUDED.name, event_date = EXCLUDED.event_date,
         capacity = EXCLUDED.capacity, status = EXCLUDED.status,
         updated_at = NOW()`,
    ['campus-open-day-ai-workshop', config.eventName, config.eventDate, config.eventCapacity],
  );

  const students = [
    ['20260001', '林知夏'],
    ['20260002', '周予安'],
    ['20260003', '陈星野'],
    ['20260004', '许清和'],
    ['20260005', '沈嘉木'],
  ];

  for (const [studentNo, displayName] of students) {
    await runQuery(
      `INSERT INTO student_identities (student_no, display_name, active)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (student_no) DO UPDATE
       SET display_name = EXCLUDED.display_name, active = TRUE`,
      [studentNo, displayName],
    );
  }

  const passwordHash = await bcrypt.hash(config.adminPassword, 12);
  await runQuery(
    `INSERT INTO admin_accounts (username, password_hash, active)
     VALUES ($1, $2, TRUE)
     ON CONFLICT (username) DO UPDATE
     SET password_hash = EXCLUDED.password_hash, active = TRUE, updated_at = NOW()`,
    [config.adminUsername, passwordHash],
  );
}

export async function getCurrentEvent() {
  const result = await runQuery<EventRecord>(
    `SELECT id, slug, name, event_date::text, capacity, status
     FROM events WHERE slug = $1 LIMIT 1`,
    ['campus-open-day-ai-workshop'],
  );
  if (!result.rows[0]) throw new AppError(503, 'EVENT_NOT_CONFIGURED', '当前活动尚未配置。');
  return result.rows[0];
}

export async function findStudentByNo(studentNo: string) {
  const result = await runQuery<StudentRecord>(
    `SELECT id, student_no, display_name
     FROM student_identities WHERE student_no = $1 AND active = TRUE`,
    [studentNo],
  );
  return result.rows[0] ?? null;
}

export async function findAdminByUsername(username: string) {
  const result = await runQuery<{ id: number; username: string; password_hash: string }>(
    `SELECT id, username, password_hash
     FROM admin_accounts WHERE username = $1 AND active = TRUE`,
    [username],
  );
  return result.rows[0] ?? null;
}

export async function createSession(subjectType: 'student' | 'admin', subjectId: number) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(`${config.sessionSecret}:${token}`).digest('hex');
  await runQuery(
    `INSERT INTO sessions (subject_type, subject_id, token_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '8 hours')`,
    [subjectType, subjectId, tokenHash],
  );
  return token;
}

export async function findSession(token: string) {
  const tokenHash = crypto.createHash('sha256').update(`${config.sessionSecret}:${token}`).digest('hex');
  const result = await runQuery<{
    subject_type: 'student' | 'admin';
    subject_id: number;
    identity: string;
  }>(
    `SELECT s.subject_type, s.subject_id,
            COALESCE(si.student_no, aa.username) AS identity
     FROM sessions s
     LEFT JOIN student_identities si ON s.subject_type = 'student' AND s.subject_id = si.id
     LEFT JOIN admin_accounts aa ON s.subject_type = 'admin' AND s.subject_id = aa.id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [tokenHash],
  );
  return result.rows[0] ?? null;
}

export async function deleteSession(token: string) {
  const tokenHash = crypto.createHash('sha256').update(`${config.sessionSecret}:${token}`).digest('hex');
  await runQuery('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
}

export async function getStudentApplication(eventId: number, studentId: number) {
  const result = await runQuery<ApplicationRecord>(
    `SELECT a.id, si.student_no, a.submitted_name, a.reason, a.status,
            a.created_at, a.reviewed_at, a.review_note, aa.username AS reviewer_username
     FROM applications a
     JOIN student_identities si ON si.id = a.student_id
     LEFT JOIN admin_accounts aa ON aa.id = a.reviewed_by
     WHERE a.event_id = $1 AND a.student_id = $2`,
    [eventId, studentId],
  );
  return result.rows[0] ?? null;
}

export async function createApplication(eventId: number, studentId: number, submittedName: string, reason: string, requestId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<ApplicationRecord>(
      `INSERT INTO applications (event_id, student_id, submitted_name, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id, submitted_name, reason, status, created_at, reviewed_at, review_note`,
      [eventId, studentId, submittedName, reason],
    );
    await client.query(
      `INSERT INTO audit_logs (actor_type, actor_id, action, target_type, target_id, request_id)
       VALUES ('student', $1, 'application.created', 'application', $2, $3)`,
      [studentId, result.rows[0].id, requestId],
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    if (isUniqueViolation(error)) {
      throw new AppError(409, 'ALREADY_APPLIED', '该学号已经提交过报名申请。');
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function getDashboard(eventId: number) {
  const result = await runQuery<{
    total: string;
    pending: string;
    approved: string;
    rejected: string;
    capacity: number;
  }>(
    `SELECT
       COUNT(a.id)::text AS total,
       COUNT(a.id) FILTER (WHERE a.status = 'pending')::text AS pending,
       COUNT(a.id) FILTER (WHERE a.status = 'approved')::text AS approved,
       COUNT(a.id) FILTER (WHERE a.status = 'rejected')::text AS rejected,
       e.capacity
     FROM events e
     LEFT JOIN applications a ON a.event_id = e.id
     WHERE e.id = $1
     GROUP BY e.id`,
    [eventId],
  );
  const row = result.rows[0];
  if (!row) throw new AppError(404, 'RESOURCE_NOT_FOUND', '活动不存在。');
  const approved = Number(row.approved);
  return {
    total: Number(row.total),
    pending: Number(row.pending),
    approved,
    rejected: Number(row.rejected),
    capacity: row.capacity,
    remaining: Math.max(row.capacity - approved, 0),
  };
}

export async function listApplications(eventId: number, status?: string) {
  const allowedStatuses = new Set(['pending', 'approved', 'rejected']);
  const normalizedStatus = status && allowedStatuses.has(status) ? status : undefined;
  const result = await runQuery<ApplicationRecord>(
    `SELECT a.id, si.student_no, a.submitted_name, a.reason, a.status,
            a.created_at, a.reviewed_at, a.review_note, aa.username AS reviewer_username
     FROM applications a
     JOIN student_identities si ON si.id = a.student_id
     LEFT JOIN admin_accounts aa ON aa.id = a.reviewed_by
     WHERE a.event_id = $1 AND ($2::text IS NULL OR a.status = $2)
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT 200`,
    [eventId, normalizedStatus ?? null],
  );
  return result.rows;
}

async function lockApplicationForReview(client: PoolClient, applicationId: number) {
  const result = await client.query<ApplicationRecord & { event_id: number; student_id: number }>(
    `SELECT a.id, a.event_id, a.student_id, si.student_no, a.submitted_name,
            a.reason, a.status, a.created_at, a.reviewed_at, a.review_note
     FROM applications a
     JOIN student_identities si ON si.id = a.student_id
     WHERE a.id = $1
     FOR UPDATE`,
    [applicationId],
  );
  const application = result.rows[0];
  if (!application) throw new AppError(404, 'RESOURCE_NOT_FOUND', '报名申请不存在。');
  if (application.status !== 'pending') {
    throw new AppError(409, 'APPLICATION_NOT_PENDING', '该申请已经完成审核。');
  }
  return application;
}

export async function approveApplication(applicationId: number, adminId: number, requestId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const application = await lockApplicationForReview(client, applicationId);
    const eventResult = await client.query<EventRecord>(
      `SELECT id, slug, name, event_date::text, capacity, status
       FROM events WHERE id = $1 FOR UPDATE`,
      [application.event_id],
    );
    const event = eventResult.rows[0];
    if (!event) throw new AppError(404, 'RESOURCE_NOT_FOUND', '活动不存在。');
    const countResult = await client.query<{ approved: string }>(
      `SELECT COUNT(*)::text AS approved FROM applications
       WHERE event_id = $1 AND status = 'approved'`,
      [event.id],
    );
    if (Number(countResult.rows[0].approved) >= event.capacity) {
      throw new AppError(409, 'QUOTA_FULL', '通过名额已满，该申请仍保持待审核。');
    }
    const updated = await client.query<ApplicationRecord>(
      `UPDATE applications
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING id, submitted_name, reason, status, created_at, reviewed_at, review_note`,
      [adminId, application.id],
    );
    await client.query(
      `INSERT INTO audit_logs (actor_type, actor_id, action, target_type, target_id, request_id)
       VALUES ('admin', $1, 'application.approved', 'application', $2, $3)`,
      [adminId, application.id, requestId],
    );
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function rejectApplication(applicationId: number, adminId: number, requestId: string, reviewNote?: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const application = await lockApplicationForReview(client, applicationId);
    const updated = await client.query<ApplicationRecord>(
      `UPDATE applications
       SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), review_note = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, submitted_name, reason, status, created_at, reviewed_at, review_note`,
      [adminId, reviewNote ?? null, application.id],
    );
    await client.query(
      `INSERT INTO audit_logs (actor_type, actor_id, action, target_type, target_id, metadata_json, request_id)
       VALUES ('admin', $1, 'application.rejected', 'application', $2, $3::jsonb, $4)`,
      [adminId, application.id, JSON.stringify({ reviewNote: reviewNote ?? null }), requestId],
    );
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function isUniqueViolation(error: unknown): error is { code: string } {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
}
