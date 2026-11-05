import type { NextApiRequest, NextApiResponse } from 'next';
import { checkCsrf } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { otherAdminExists, updateUser, User } from '@/lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ error: 'Forbidden' });
  const session = await getSession(req, res);
  if (!session.userId || session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { id, username, password, role } = (req.body ?? {}) as {
    id?: number; username?: unknown; password?: unknown; role?: string;
  };

  if (typeof id !== 'number') return res.status(400).json({ error: 'Missing id' });
  if (username && (typeof username !== 'string' || username.trim().length < 2 || username.trim().length > 50)) {
    return res.status(400).json({ error: 'Username must be 2–50 characters' });
  }
  if (password && (typeof password !== 'string' || password.length < 8 || password.length > 72)) {
    return res.status(400).json({ error: 'Password must be 8–72 characters' });
  }
  // Demoting the only admin would leave nobody able to manage the server.
  if (role && role !== 'admin' && !otherAdminExists(id)) {
    return res.status(400).json({ error: 'There must always be at least one admin' });
  }

  try {
    updateUser(id, {
      username: (username as string) || undefined,
      password: password ? bcrypt.hashSync(password as string, 12) : undefined,
      role: role && ['admin', 'mod', 'user'].includes(role) ? (role as User['role']) : undefined,
    });
    // Changing your own password here would otherwise sign you out on your next request.
    if (password && id === session.userId) {
      session.tokenVersion = (session.tokenVersion ?? 0) + 1;
      await session.save();
    }
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(409).json({ error: e instanceof Error ? e.message : 'Error' });
  }
}
