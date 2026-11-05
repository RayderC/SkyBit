import type { NextApiRequest, NextApiResponse } from 'next';
import { checkCsrf } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { getUserById, updateUser } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ error: 'Forbidden' });
  const session = await getSession(req, res);
  if (!session.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { username, currentPassword, newPassword } = (req.body ?? {}) as {
    username?: unknown; currentPassword?: unknown; newPassword?: unknown;
  };

  const user = getUserById(session.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const updates: { username?: string; password?: string } = {};

  if (newPassword) {
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 72) {
      return res.status(400).json({ error: 'New password must be 8–72 characters' });
    }
    if (!checkRateLimit(`pwchange:${user.id}`, 10, 60_000)) {
      return res.status(429).json({ error: 'Too many attempts — try again in a minute' });
    }
    if (typeof currentPassword !== 'string' || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    updates.password = bcrypt.hashSync(newPassword, 12);
  }

  if (username && username !== user.username) {
    if (typeof username !== 'string' || username.trim().length < 2 || username.trim().length > 50) {
      return res.status(400).json({ error: 'Username must be 2–50 characters' });
    }
    updates.username = username.trim();
  }

  try {
    if (Object.keys(updates).length > 0) {
      updateUser(user.id, updates);
      if (updates.username) session.username = updates.username;
      // Other devices get signed out. Keep this one signed in with the new version.
      if (updates.password) session.tokenVersion = (user.tokenVersion ?? 0) + 1;
      await session.save();
    }
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(409).json({ error: e instanceof Error ? e.message : 'Error' });
  }
}
