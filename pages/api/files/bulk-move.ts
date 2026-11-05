import type { NextApiRequest, NextApiResponse } from 'next';
import { checkCsrf } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { resolveSafePath, resolveEntryPath, getUniquePath } from '@/lib/fs';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ error: 'Forbidden' });
  const session = await getSession(req, res);
  if (!session.userId || !['admin', 'mod'].includes(session.role!)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { paths, dest } = req.body as { paths: string[]; dest: string };
  if (!Array.isArray(paths) || !dest) return res.status(400).json({ error: 'Missing params' });

  let destDir: string;
  try {
    destDir = resolveSafePath(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid destination' });
  }

  const errors: string[] = [];
  for (const p of paths) {
    try {
      const srcPath = resolveEntryPath(p);
      const destPath = getUniquePath(path.join(destDir, path.basename(srcPath)));
      fs.renameSync(srcPath, destPath);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  res.json({ ok: errors.length === 0, errors });
}
