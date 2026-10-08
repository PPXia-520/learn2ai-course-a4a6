import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { attachAuth, endSession, removeCurrentSession, requireAuth, requireRole, startSession } from './auth';
import { config } from './config';
import {
  approveApplication,
  createApplication,
  findAdminByUsername,
  findStudentByNo,
  getCurrentEvent,
  getDashboard,
  getStudentApplication,
  listApplications,
  rejectApplication,
} from './db';
import { AppError } from './errors';

const studentLoginSchema = z.object({ studentNo: z.string().trim().min(1).max(32) });
const adminLoginSchema = z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(256) });
const applicationSchema = z.object({
  name: z.string().trim().min(2, '姓名至少需要 2 个字符。').max(40, '姓名不能超过 40 个字符。'),
  reason: z.string().trim().min(10, '报名理由至少需要 10 个字符。').max(500, '报名理由不能超过 500 个字符。'),
});
const reviewSchema = z.object({ note: z.string().trim().max(200, '审核备注不能超过 200 个字符。').optional() });

const requestIdMiddleware = (request: Request, response: Response, next: NextFunction) => {
  const requestId = request.header('x-request-id')?.slice(0, 80) || crypto.randomUUID();
  request.requestId = requestId;
  response.setHeader('x-request-id', requestId);
  next();
};

const parseBody = <T>(schema: z.ZodSchema<T>, body: unknown): T => {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      422,
      'VALIDATION_FAILED',
      '请检查表单内容。',
      parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    );
  }
  return parsed.data;
};

const asyncRoute = (handler: (request: Request, response: Response) => Promise<void>) => {
  return (request: Request, response: Response, next: NextFunction) => {
    handler(request, response).catch(next);
  };
};

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.use(attachAuth);

  app.get('/api/health', asyncRoute(async (_request, response) => {
    const event = await getCurrentEvent();
    response.json({ ok: true, service: 'campus-open-day', database: true, event: event.slug });
  }));

  app.get('/api/event', asyncRoute(async (_request, response) => {
    const event = await getCurrentEvent();
    response.json({ event });
  }));

  app.post('/api/auth/student/login', asyncRoute(async (request, response) => {
    const { studentNo } = parseBody(studentLoginSchema, request.body);
    const student = await findStudentByNo(studentNo);
    if (!student) throw new AppError(401, 'INVALID_STUDENT_ID', '学号无效，请使用教师提供的测试账号。');
    await startSession(response, 'student', student.id);
    response.json({ user: { role: 'student', identity: student.student_no, displayName: student.display_name } });
  }));

  app.post('/api/auth/admin/login', asyncRoute(async (request, response) => {
    const { username, password } = parseBody(adminLoginSchema, request.body);
    const admin = await findAdminByUsername(username);
    const valid = admin ? await bcrypt.compare(password, admin.password_hash) : false;
    if (!valid) throw new AppError(401, 'INVALID_CREDENTIALS', '账号或密码错误。');
    await startSession(response, 'admin', admin.id);
    response.json({ user: { role: 'admin', identity: admin.username } });
  }));

  app.post('/api/auth/logout', requireAuth, asyncRoute(async (request, response) => {
    await removeCurrentSession(request);
    endSession(response);
    response.status(204).send();
  }));

  app.get('/api/me', asyncRoute(async (request, response) => {
    if (!request.user) {
      response.json({ user: null });
      return;
    }
    response.json({ user: request.user });
  }));

  app.get('/api/student/application', requireRole('student'), asyncRoute(async (request, response) => {
    const event = await getCurrentEvent();
    const application = await getStudentApplication(event.id, request.user!.subjectId);
    response.json({ application });
  }));

  app.post('/api/student/application', requireRole('student'), asyncRoute(async (request, response) => {
    const data = parseBody(applicationSchema, request.body);
    const event = await getCurrentEvent();
    if (event.status !== 'open') throw new AppError(409, 'EVENT_CLOSED', '当前活动已停止报名。');
    const application = await createApplication(event.id, request.user!.subjectId, data.name, data.reason, request.requestId!);
    response.status(201).json({ application });
  }));

  app.get('/api/admin/dashboard', requireRole('admin'), asyncRoute(async (_request, response) => {
    const event = await getCurrentEvent();
    const dashboard = await getDashboard(event.id);
    response.json({ event, dashboard });
  }));

  app.get('/api/admin/applications', requireRole('admin'), asyncRoute(async (request, response) => {
    const event = await getCurrentEvent();
    const status = typeof request.query.status === 'string' ? request.query.status : undefined;
    const applications = await listApplications(event.id, status);
    response.json({ applications });
  }));

  app.post('/api/admin/applications/:id/approve', requireRole('admin'), asyncRoute(async (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) throw new AppError(422, 'VALIDATION_FAILED', '申请编号无效。');
    const application = await approveApplication(id, request.user!.subjectId, request.requestId!);
    response.json({ application });
  }));

  app.post('/api/admin/applications/:id/reject', requireRole('admin'), asyncRoute(async (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) throw new AppError(422, 'VALIDATION_FAILED', '申请编号无效。');
    const { note } = parseBody(reviewSchema, request.body ?? {});
    const application = await rejectApplication(id, request.user!.subjectId, request.requestId!, note);
    response.json({ application });
  }));

  const publicDirectory = path.resolve(process.cwd(), 'server/public');
  if (fs.existsSync(publicDirectory)) {
    app.use(express.static(publicDirectory));
    app.get(/^(?!\/api).*/, (_request, response) => {
      response.sendFile(path.join(publicDirectory, 'index.html'));
    });
  }

  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    const appError = error instanceof AppError
      ? error
      : new AppError(500, 'INTERNAL_ERROR', '服务暂时不可用，请稍后重试。');
    if (!(error instanceof AppError)) console.error(error);
    response.status(appError.statusCode).json({
      error: {
        code: appError.code,
        message: appError.message,
        details: appError.details,
        requestId: request.requestId,
      },
    });
  });

  return app;
}
