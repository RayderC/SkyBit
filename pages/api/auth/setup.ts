import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';
import { countUsers, createUser } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.json({ needsSetup: countUsers() === 0 });
  }

  if (req.method === 'POST') {
    if (countUsers() > 0) {
      return res.status(403).json({ error: 'Already set up' });
    }
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (username.trim().length < 2) {
      return res.status(400).json({ error: 'Username must be at least 2 characters' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const hash = bcrypt.hashSync(password, 12);
    createUser(username.trim().toLowerCase(), hash, 'admin');

    const session = await getIronSession<{ userId?: number; username?: string; role?: string }>(req, res, sessionOptions);
    const users = (await import('@/lib/db')).listUsers();
    const created = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (created) {
      session.userId = created.id;
      session.username = created.username;
      session.role = 'admin';
      await session.save();
    }

    return res.json({ ok: true });
  }

  res.status(405).end();
}
