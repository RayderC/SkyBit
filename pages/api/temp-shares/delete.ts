import type { NextApiRequest, NextApiResponse } from 'next';
import { checkCsrf } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { deleteShare } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ error: 'Forbidden' });
  const session = await getSession(req, res);
  if (!session.userId || session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { token } = req.body as { token: string };
  deleteShare(token);
  res.json({ ok: true });
}
