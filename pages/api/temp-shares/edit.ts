import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { updateShare } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId || session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { token, expiresIn } = req.body as { token: string; expiresIn: number };
  const expiresAt = new Date(Date.now() + expiresIn * 60 * 1000).toISOString();
  updateShare(token, expiresAt);
  res.json({ ok: true });
}
