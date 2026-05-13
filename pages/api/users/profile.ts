import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { getUserById, updateUser } from '@/lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { username, currentPassword, newPassword } = req.body as {
    username?: string; currentPassword?: string; newPassword?: string;
  };

  const user = getUserById(session.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const updates: { username?: string; password?: string } = {};

  if (newPassword) {
    if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    updates.password = bcrypt.hashSync(newPassword, 12);
  }

  if (username && username !== user.username) {
    updates.username = username.trim();
  }

  try {
    if (Object.keys(updates).length > 0) {
      updateUser(user.id, updates);
      if (updates.username) {
        session.username = updates.username;
        await session.save();
      }
    }
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(409).json({ error: e instanceof Error ? e.message : 'Error' });
  }
}
