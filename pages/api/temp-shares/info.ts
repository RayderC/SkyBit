import type { NextApiRequest, NextApiResponse } from 'next';
import { getShare } from '@/lib/db';
import { getSession } from '@/lib/session';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.query.token as string;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const share = getShare(token);
  if (!share) return res.status(404).json({ error: 'Share not found' });
  if (new Date(share.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Link has expired' });
  }

  // A locked link doesn't even say what it is until the password is given.
  if (share.passwordHash) {
    const session = await getSession(req, res);
    if (!session.unlockedShares?.includes(token)) return res.json({ locked: true, expires_at: share.expires_at });
  }
  res.json({
    filename: path.basename(share.filepath),
    expires_at: share.expires_at,
    locked: false,
  });
}
