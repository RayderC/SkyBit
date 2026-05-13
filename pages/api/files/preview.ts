import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { resolveSafePath, getFileType, TEXT_EXTS } from '@/lib/fs';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId) return res.status(401).json({ error: 'Unauthorized' });

  const filePath = (req.query.path as string) || '';
  try {
    const resolved = resolveSafePath(filePath);
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Not found' });

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) return res.status(400).json({ error: 'Is a directory' });

    const fileType = getFileType(path.basename(resolved));
    const ext = path.extname(resolved).toLowerCase();

    if (fileType === 'text' || TEXT_EXTS.has(ext)) {
      const content = fs.readFileSync(resolved, 'utf8');
      return res.json({ fileType: 'text', content, size: stat.size });
    }

    res.json({ fileType, size: stat.size, name: path.basename(resolved) });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' });
  }
}
