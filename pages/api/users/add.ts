import type { NextApiRequest, NextApiResponse } from 'next';
import { checkCsrf } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { createUser, User } from '@/lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ error: 'Forbidden' });
  const session = await getSession(req, res);
  if (!session.userId || session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { username, password, role } = (req.body ?? {}) as { username?: unknown; password?: unknown; role?: string };
  if (typeof username !== 'string' || typeof password !== 'string' || !['admin', 'mod', 'user'].includes(role ?? '')) {
    return res.status(400).json({ error: 'Invalid params' });
  }
  const name = username.trim();
  if (name.length < 2 || name.length > 50) return res.status(400).json({ error: 'Username must be 2–50 characters' });
  if (password.length < 8 || password.length > 72) return res.status(400).json({ error: 'Password must be 8–72 characters' });

  try {
    createUser(name, bcrypt.hashSync(password, 12), role as User['role']);
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(409).json({ error: e instanceof Error ? e.message : 'Error' });
  }
}
