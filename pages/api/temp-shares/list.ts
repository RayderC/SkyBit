import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@/lib/session';
import { listShares, cleanupExpiredShares } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.userId || session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  cleanupExpiredShares();
  // The password itself never leaves the server, only whether there is one.
  res.json(listShares().map(({ passwordHash, ...s }) => ({ ...s, hasPassword: !!passwordHash })));
}
