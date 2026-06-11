import type { SessionOptions } from 'iron-session';

export interface SessionData {
  userId?: number;
  username?: string;
  role?: 'admin' | 'mod' | 'user';
}

const isBuild = process.env.NEXT_PHASE === 'phase-production-build';

const sessionPassword =
  process.env.SESSION_SECRET ||
  process.env.SECRET_KEY ||
  (isBuild || process.env.NODE_ENV !== 'production'
    ? 'build_time_placeholder_secret_at_least_32_chars'
    : '');

if (!sessionPassword || sessionPassword.length < 32) {
  throw new Error(
    'SESSION_SECRET (or SECRET_KEY) environment variable must be set to a string of at least 32 characters'
  );
}

export const sessionOptions: SessionOptions = {
  password: sessionPassword,
  cookieName: 'skybit-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  },
};
