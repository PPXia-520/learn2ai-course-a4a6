export type Role = 'student' | 'admin';

export interface AuthUser {
  role: Role;
  subjectId: number;
  identity: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
    }
  }
}

export {};
