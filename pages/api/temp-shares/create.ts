import type { NextApiRequest, NextApiResponse } from 'next';
import { checkCsrf } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { createShare } from '@/lib/db';
import { resolveEntryPath } from '@/lib/fs';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ error: 'Forbidden' });
  const session = await getSession(req, res);
  if (!session.userId || !['admin', 'mod'].includes(session.role!)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { path: filePath, expiresIn } = req.body as { path: string; expiresIn: number };
  // Up to a year. A huge value would produce an invalid date.
  if (!filePath || !Number.isFinite(expiresIn) || expiresIn < 1 || expiresIn > 525_600) {
    return res.status(400).json({ error: 'Invalid params' });
  }

  try {
    const resolved = resolveEntryPath(filePath);
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'File not found' });

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + expiresIn * 60 * 1000).toISOString();
    createShare(token, filePath, expiresAt);
    res.json({ token, expiresAt });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' });
  }
}
