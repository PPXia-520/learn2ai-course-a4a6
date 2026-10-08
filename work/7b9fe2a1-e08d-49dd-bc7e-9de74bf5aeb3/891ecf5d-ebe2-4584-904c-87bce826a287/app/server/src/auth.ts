import type { RequestHandler, Response } from 'express';
import { config } from './config';
import { createSession, deleteSession, findSession } from './db';
import { AppError } from './errors';
import type { Role } from './types';

const maxAge = 8 * 60 * 60 * 1000;

export async function startSession(response: Response, role: Role, subjectId: number) {
  const token = await createSession(role, subjectId);
  response.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge,
    path: '/',
  });
}

export function endSession(response: Response) {
  response.clearCookie(config.cookieName, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/' });
}

export const attachAuth: RequestHandler = async (request, _response, next) => {
  try {
    const token = request.cookies?.[config.cookieName];
    if (!token) return next();
    const session = await findSession(token);
    if (session) {
      request.user = {
        role: session.subject_type,
        subjectId: session.subject_id,
        identity: session.identity,
      };
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAuth: RequestHandler = (request, _response, next) => {
  if (!request.user) return next(new AppError(401, 'UNAUTHENTICATED', '请先登录。'));
  next();
};

export const requireRole = (...roles: Role[]): RequestHandler => (request, _response, next) => {
  if (!request.user) return next(new AppError(401, 'UNAUTHENTICATED', '请先登录。'));
  if (!roles.includes(request.user.role)) {
    return next(new AppError(403, 'FORBIDDEN', '当前账号没有执行此操作的权限。'));
  }
  next();
};

export async function removeCurrentSession(request: Parameters<RequestHandler>[0]) {
  const token = request.cookies?.[config.cookieName];
  if (token) await deleteSession(token);
}
