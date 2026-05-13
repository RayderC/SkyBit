import type { SessionOptions } from 'iron-session';

export interface SessionData {
  userId?: number;
  username?: string;
  role?: 'admin' | 'mod' | 'user';
}

export const sessionOptions: SessionOptions = {
  password: process.env.SECRET_KEY || 'skybit-default-secret-key-change-this-now!!',
  cookieName: 'skybit-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
  },
};
