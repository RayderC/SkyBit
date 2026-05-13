import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { resolveSafePath, getUniquePath, copyRecursive } from '@/lib/fs';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId || !['admin', 'mod'].includes(session.role!)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { paths, dest } = req.body as { paths: string[]; dest: string };
  if (!Array.isArray(paths) || !dest) return res.status(400).json({ error: 'Missing params' });

  const destDir = resolveSafePath(dest);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const errors: string[] = [];
  for (const p of paths) {
    try {
      const srcPath = resolveSafePath(p);
      const destPath = getUniquePath(path.join(destDir, path.basename(srcPath)));
      copyRecursive(srcPath, destPath);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  res.json({ ok: errors.length === 0, errors });
}
