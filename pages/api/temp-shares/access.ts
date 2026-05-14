import type { NextApiRequest, NextApiResponse } from 'next';
import { getShare } from '@/lib/db';
import { resolveSafePath } from '@/lib/fs';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

export const config = { api: { responseLimit: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.query.token as string;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  // If not an explicit download request, redirect to the share page
  if (!req.query.dl) {
    res.redirect(302, `/share?token=${encodeURIComponent(token)}`);
    return;
  }

  const share = getShare(token);
  if (!share) return res.status(404).json({ error: 'Share not found' });
  if (new Date(share.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Link has expired' });
  }

  try {
    const resolved = resolveSafePath(share.filepath);
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'File not found' });

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(path.basename(resolved))}.zip"`
      );
      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.pipe(res);
      archive.directory(resolved, path.basename(resolved));
      await archive.finalize();
    } else {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(path.basename(resolved))}"`
      );
      res.setHeader('Content-Length', stat.size);
      fs.createReadStream(resolved).pipe(res);
    }
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' });
  }
}
