import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { resolveSafePath } from '@/lib/fs';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId || !['admin', 'mod'].includes(session.role!)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { from, newName } = req.body as { from: string; newName: string };
  if (!from || !newName) return res.status(400).json({ error: 'Missing params' });
  if (newName.includes('/') || newName.includes('\\')) {
    return res.status(400).json({ error: 'Invalid name' });
  }

  try {
    const srcPath = resolveSafePath(from);
    const destPath = path.join(path.dirname(srcPath), newName);
    if (fs.existsSync(destPath)) return res.status(409).json({ error: 'Name already exists' });
    fs.renameSync(srcPath, destPath);
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' });
  }
}
