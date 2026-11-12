import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserById } from './db';

export interface SessionData {
  userId?: number;
  username?: string;
  role?: 'admin' | 'mod' | 'user';
  /** The user's tokenVersion at sign-in. Changing a password bumps it, which ends other sessions. */
  tokenVersion?: number;
  /** Password-protected share links this visitor has unlocked. Works without an account. */
  unlockedShares?: string[];
}

const isBuild = process.env.NEXT_PHASE === 'phase-production-build';

const sessionPassword =
  process.env.SECRET_KEY ||
  (isBuild || process.env.NODE_ENV !== 'production'
    ? 'build_time_placeholder_secret_at_least_32_chars'
    : '');

if (!sessionPassword || sessionPassword.length < 32) {
  throw new Error(
    'SECRET_KEY environment variable must be set to a string of at least 32 characters'
  );
}

export const sessionOptions: SessionOptions = {
  password: sessionPassword,
  cookieName: 'skybit-session',
  ttl: 60 * 60 * 24 * 30,
  cookieOptions: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
  },
};

/** Secure on HTTPS (including through a tunnel), but still able to sign in over plain HTTP on a LAN. */
function optionsFor(req: NextApiRequest): SessionOptions {
  const env = process.env.SESSION_COOKIE_SECURE;
  const secure = env != null ? env === 'true' : req.headers['x-forwarded-proto'] === 'https';
  return { ...sessionOptions, cookieOptions: { ...sessionOptions.cookieOptions, secure } };
}

/**
 * Loads the session and checks it against the current account, so deleting a user, changing their
 * role or changing their password takes effect at once instead of when the cookie expires.
 */
export async function getSession(req: NextApiRequest, res: NextApiResponse): Promise<IronSession<SessionData>> {
  const session = await getIronSession<SessionData>(req, res, optionsFor(req));
  if (session.userId) {
    const user = getUserById(session.userId);
    if (!user || (user.tokenVersion ?? 0) !== (session.tokenVersion ?? 0)) {
      session.destroy();
    } else {
      session.username = user.username;
      session.role = user.role;
    }
  }
  return session;
}
