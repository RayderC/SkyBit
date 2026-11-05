import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/session';
import { countUsers, createUser, getUserByUsername } from '@/lib/db';
import { checkCsrf } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/clientIp';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.json({ needsSetup: countUsers() === 0 });
  }

  if (req.method === 'POST') {
    if (!checkCsrf(req)) return res.status(403).json({ error: 'Forbidden' });
    if (!checkRateLimit(`setup:${clientIp(req)}`, 10, 60_000)) {
      return res.status(429).json({ error: 'Slow down' });
    }
    if (countUsers() > 0) {
      return res.status(403).json({ error: 'Already set up' });
    }
    const { username, password } = (req.body ?? {}) as { username?: unknown; password?: unknown };
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const name = username.trim().toLowerCase();
    if (name.length < 2 || name.length > 50) {
      return res.status(400).json({ error: 'Username must be 2–50 characters' });
    }
    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({ error: 'Password must be 8–72 characters' });
    }

    // No await between the check above and this line, so two requests can't both become admin.
    createUser(name, bcrypt.hashSync(password, 12), 'admin');

    const created = getUserByUsername(name);
    if (created) {
      const session = await getSession(req, res);
      session.userId = created.id;
      session.username = created.username;
      session.role = 'admin';
      session.tokenVersion = 0;
      await session.save();
    }

    return res.json({ ok: true });
  }

  res.status(405).end();
}
