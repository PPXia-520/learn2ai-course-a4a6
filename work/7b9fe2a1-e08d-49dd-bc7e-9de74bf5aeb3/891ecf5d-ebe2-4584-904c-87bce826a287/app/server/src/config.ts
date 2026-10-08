import dotenv from 'dotenv';

dotenv.config();

const asNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: asNumber(process.env.PORT, 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://campus_app:campus_app@localhost:55432/campus_open_day',
  databaseAdminUrl: process.env.DATABASE_ADMIN_URL ?? 'postgresql://campus_app:campus_app@localhost:55432/postgres',
  sessionSecret: process.env.SESSION_SECRET ?? 'local-only-session-secret-change-me',
  adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin123!',
  eventName: process.env.EVENT_NAME ?? '校园开放日 AI 实践工作坊',
  eventDate: process.env.EVENT_DATE ?? '2026-11-21',
  eventCapacity: asNumber(process.env.EVENT_CAPACITY, 100),
  cookieName: 'campus_session',
  cookieSecure: process.env.COOKIE_SECURE === undefined
    ? process.env.NODE_ENV === 'production'
    : process.env.COOKIE_SECURE === 'true',
};

if (config.nodeEnv === 'production' && config.sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters in production.');
}
