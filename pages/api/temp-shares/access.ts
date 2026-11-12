import type { NextApiRequest, NextApiResponse } from 'next';
import { getShare } from '@/lib/db';
import { getSession } from '@/lib/session';
import { resolveSafePath, contentDisposition } from '@/lib/fs';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { ZipArchive } from 'archiver';

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
  if (share.passwordHash) {
    const session = await getSession(req, res);
    if (!session.unlockedShares?.includes(token)) return res.status(401).json({ error: 'This link needs its password' });
  }

  try {
    const resolved = resolveSafePath(share.filepath);
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'File not found' });

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', contentDisposition('attachment', `${path.basename(resolved)}.zip`));
      const archive = new ZipArchive({ zlib: { level: 6 } });
      archive.on('error', (e) => { console.error('[share]', e); res.destroy(); });
      res.on('close', () => { if (!res.writableFinished) archive.abort(); });
      archive.pipe(res);
      archive.directory(resolved, path.basename(resolved));
      await archive.finalize();
    } else {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', contentDisposition('attachment', path.basename(resolved)));
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'no-store');
      await pipeline(fs.createReadStream(resolved), res).catch(() => res.destroy());
    }
  } catch (e: unknown) {
    if (res.headersSent) return void res.destroy();
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' });
  }
}
