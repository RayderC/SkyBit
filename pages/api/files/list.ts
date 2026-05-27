export const config = { api: { responseLimit: false } };

import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { resolveSafePath, getFileType, detectImageFolder, formatSize, ensureBaseDir } from '@/lib/fs';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId) return res.status(401).json({ error: 'Unauthorized' });

  ensureBaseDir();

  const folder = (req.query.folder as string) || '';

  try {
    const dirPath = resolveSafePath(folder);
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const files = (await Promise.all(
      entries.map(async (e) => {
        const fullPath = path.join(dirPath, e.name);
        let size: number | null = null;
        let modified = '';
        try {
          const stat = await fs.promises.stat(fullPath);
          size = e.isDirectory() ? null : stat.size;
          modified = stat.mtime.toISOString();
        } catch { /* ignore */ }
        return {
          name: e.name,
          isDir: e.isDirectory(),
          type: e.isDirectory() ? 'folder' : getFileType(e.name),
          size,
          sizeFormatted: size != null ? formatSize(size) : null,
          modified,
        };
      })
    ))
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

    const isImageFolder = detectImageFolder(files.map((f) => ({ name: f.name, isDir: f.isDir })));

    res.json({ files, isImageFolder, role: session.role, folder });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error';
    res.status(400).json({ error: msg });
  }
}
