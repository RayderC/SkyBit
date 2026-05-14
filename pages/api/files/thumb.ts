import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { resolveSafePath, RAW_EXTS } from '@/lib/fs';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const config = { api: { responseLimit: false } };

const SOI = Buffer.from([0xff, 0xd8, 0xff]);
const EOI = Buffer.from([0xff, 0xd9]);

// Store cache alongside config/data.json, not inside the user's files volume
const configDir = process.env.DATABASE_PATH
  ? path.dirname(process.env.DATABASE_PATH)
  : path.join(process.cwd(), 'config');
const THUMB_CACHE = path.join(configDir, 'thumbcache');

function getCachePath(resolved: string, mtimeMs: number): string {
  const hash = crypto.createHash('sha1').update(`${resolved}:${mtimeMs}`).digest('hex');
  return path.join(THUMB_CACHE, `${hash}.jpg`);
}

function extractJpeg(data: Buffer): Buffer | null {
  let best: Buffer | null = null;
  let offset = 0;
  while (offset < data.length - 3) {
    const start = data.indexOf(SOI, offset);
    if (start < 0) break;
    const end = data.indexOf(EOI, start + 4);
    if (end < 0) break;
    const candidate = data.subarray(start, end + 2);
    if (!best || candidate.length > best.length) best = candidate;
    offset = start + 3;
  }
  return best && best.length > 10 * 1024 ? best : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    const ext = path.extname(resolved).toLowerCase();

    // RAW files: extract JPEG once, cache to disk, serve from cache on repeat visits
    if (RAW_EXTS.has(ext)) {
      if (!fs.existsSync(THUMB_CACHE)) {
        fs.mkdirSync(THUMB_CACHE, { recursive: true });
      }

      const cachePath = getCachePath(resolved, stat.mtimeMs);

      if (fs.existsSync(cachePath)) {
        const cached = fs.readFileSync(cachePath);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Length', cached.length);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.end(cached);
      }

      const data = await fs.promises.readFile(resolved);
      const jpeg = extractJpeg(data);

      if (jpeg) {
        try { fs.writeFileSync(cachePath, jpeg); } catch { /* cache write failure is non-fatal */ }
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Length', jpeg.length);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.end(jpeg);
      }

      return res.status(422).json({ error: 'No preview found in RAW file' });
    }

    // Regular images: stream directly with long cache headers
    const mimeMap: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.avif': 'image/avif', '.bmp': 'image/bmp',
      '.heic': 'image/heic', '.heif': 'image/heif', '.tiff': 'image/tiff',
    };
    res.setHeader('Content-Type', mimeMap[ext] || 'image/jpeg');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    fs.createReadStream(resolved).pipe(res);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error';
    res.status(400).json({ error: msg });
  }
}
