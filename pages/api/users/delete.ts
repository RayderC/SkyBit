import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { deleteUser } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId || session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { id } = req.body as { id: number };
  if (id === session.userId) return res.status(400).json({ error: 'Cannot delete yourself' });

  deleteUser(id);
  res.json({ ok: true });
}
