import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { updateUser, User } from '@/lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId || session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { id, username, password, role } = req.body as {
    id: number; username?: string; password?: string; role?: string;
  };

  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    updateUser(id, {
      username: username || undefined,
      password: password ? bcrypt.hashSync(password, 12) : undefined,
      role: role && ['admin', 'mod', 'user'].includes(role) ? (role as User['role']) : undefined,
    });
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(409).json({ error: e instanceof Error ? e.message : 'Error' });
  }
}
