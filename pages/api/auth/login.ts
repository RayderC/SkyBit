import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { getUserByUsername } from '@/lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

  const user = getUserByUsername(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.userId = user.id;
  session.username = user.username;
  session.role = user.role;
  await session.save();

  res.json({ ok: true, username: user.username, role: user.role });
}
