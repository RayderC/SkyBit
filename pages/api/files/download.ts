import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { resolveSafePath, IMAGE_EXTS } from '@/lib/fs';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

export const config = { api: { responseLimit: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow token-based access for temp shares (no session required)
  const token = req.query.token as string | undefined;
  if (!token) {
    const session = await getIronSession<SessionData>(req, res, sessionOptions);
    if (!session.userId) return res.status(401).json({ error: 'Unauthorized' });
  }

  const filePath = (req.query.path as string) || '';

  try {
    const resolved = resolveSafePath(filePath);
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Not found' });

    const stat = fs.statSync(resolved);

    // ZIP download for directories
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
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    const isInline =
      IMAGE_EXTS.has(ext) ||
      ['.mp4', '.webm', '.mov', '.mp3', '.wav', '.ogg', '.pdf'].includes(ext);

    res.setHeader(
      'Content-Disposition',
      `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(path.basename(resolved))}"`
    );
    res.setHeader('Content-Length', stat.size);

    const mimeMap: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.avif': 'image/avif', '.bmp': 'image/bmp',
      '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
      '.pdf': 'application/pdf',
    };
    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', isInline ? 'public, max-age=3600' : 'no-cache');

    fs.createReadStream(resolved).pipe(res);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error';
    res.status(400).json({ error: msg });
  }
}
