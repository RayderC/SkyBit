import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@/lib/session';
import { getUserByUsername } from '@/lib/db';
import { checkCsrf } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/clientIp';
import bcrypt from 'bcryptjs';

// Compared against when the username doesn't exist, so a miss takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);
const TOO_MANY = 'Too many login attempts — try again in a minute';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ error: 'Forbidden' });

  if (!checkRateLimit(`login:${clientIp(req)}`, 10, 60_000)) {
    return res.status(429).json({ error: TOO_MANY });
  }

  const { username, password } = (req.body ?? {}) as { username?: unknown; password?: unknown };
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  const name = username.trim().toLowerCase();
  // A per-account limit too, so guessing one password from many addresses still gets slowed down.
  if (!checkRateLimit(`login-user:${name}`, 30, 10 * 60_000)) {
    return res.status(429).json({ error: TOO_MANY });
  }

  const user = getUserByUsername(name);
  const matches = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !matches) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const session = await getSession(req, res);
  session.userId = user.id;
  session.username = user.username;
  session.role = user.role;
  session.tokenVersion = user.tokenVersion ?? 0;
  await session.save();

  res.json({ ok: true, username: user.username, role: user.role });
}
