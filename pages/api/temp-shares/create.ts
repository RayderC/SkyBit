import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { createShare } from '@/lib/db';
import { resolveSafePath } from '@/lib/fs';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId || !['admin', 'mod'].includes(session.role!)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { path: filePath, expiresIn } = req.body as { path: string; expiresIn: number };
  if (!filePath || !expiresIn || expiresIn < 1) {
    return res.status(400).json({ error: 'Invalid params' });
  }

  try {
    const resolved = resolveSafePath(filePath);
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'File not found' });

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + expiresIn * 60 * 1000).toISOString();
    createShare(token, filePath, expiresAt);
    res.json({ token, expiresAt });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' });
  }
}
