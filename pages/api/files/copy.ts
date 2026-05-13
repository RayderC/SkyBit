import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { resolveSafePath, getUniquePath, copyRecursive } from '@/lib/fs';
import path from 'path';
import fs from 'fs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId || !['admin', 'mod'].includes(session.role!)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { src, dest } = req.body as { src: string; dest: string };
  try {
    const srcPath = resolveSafePath(src);
    const destDir = resolveSafePath(dest);
    const destPath = getUniquePath(path.join(destDir, path.basename(srcPath)));
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    copyRecursive(srcPath, destPath);
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' });
  }
}
