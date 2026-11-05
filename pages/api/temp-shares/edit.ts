import type { NextApiRequest, NextApiResponse } from 'next';
import { checkCsrf } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { updateShare } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ error: 'Forbidden' });
  const session = await getSession(req, res);
  if (!session.userId || session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { token, expiresIn } = req.body as { token: string; expiresIn: number };
  if (!Number.isFinite(expiresIn) || expiresIn < 1 || expiresIn > 525_600) {
    return res.status(400).json({ error: 'Invalid params' });
  }
  const expiresAt = new Date(Date.now() + expiresIn * 60 * 1000).toISOString();
  updateShare(token, expiresAt);
  res.json({ ok: true });
}
