import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { resolveSafePath, RAW_EXTS } from '@/lib/fs';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';

export const config = { api: { responseLimit: false } };

const SOI = Buffer.from([0xff, 0xd8, 0xff]);
const EOI = Buffer.from([0xff, 0xd9]);

// Thumbnail size — 300×300 covers 160px grid tiles at 2× density
const THUMB_SIZE = 300;

// Store cache alongside config/data.json, not inside the user's files volume
const configDir = process.env.DATABASE_PATH
  ? path.dirname(process.env.DATABASE_PATH)
  : path.join(process.cwd(), 'config');
const THUMB_CACHE = path.join(configDir, 'thumbcache');

// Include THUMB_SIZE in the hash so changing the size busts old cached thumbs
function getCachePath(resolved: string, mtimeMs: number, size: number): string {
  const hash = crypto.createHash('sha1').update(`${resolved}:${mtimeMs}:${size}`).digest('hex');
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

async function ensureThumbCache() {
  if (!fs.existsSync(THUMB_CACHE)) {
    await fs.promises.mkdir(THUMB_CACHE, { recursive: true });
  }
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

    const stat = await fs.promises.stat(resolved);
    const ext = path.extname(resolved).toLowerCase();

    await ensureThumbCache();
    const cachePath = getCachePath(resolved, stat.mtimeMs, THUMB_SIZE);

    // Serve from cache if available (covers both RAW and regular images)
    if (fs.existsSync(cachePath)) {
      const cached = await fs.promises.readFile(cachePath);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Length', cached.length);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.end(cached);
    }

    // ── RAW camera files: extract embedded JPEG preview, then resize ─────────
    if (RAW_EXTS.has(ext)) {
      const data = await fs.promises.readFile(resolved);
      const rawJpeg = extractJpeg(data);

      if (rawJpeg) {
        // Resize the extracted preview to our thumbnail size
        const thumb = await sharp(rawJpeg)
          .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover', position: 'centre' })
          .rotate()
          .jpeg({ quality: 82 })
          .toBuffer();

        try { await fs.promises.writeFile(cachePath, thumb); } catch { /* non-fatal */ }
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Length', thumb.length);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.end(thumb);
      }

      return res.status(422).json({ error: 'No preview found in RAW file' });
    }

    // ── Regular images: resize to THUMB_SIZE × THUMB_SIZE via sharp ──────────
    const thumb = await sharp(resolved)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover', position: 'centre' })
      .rotate()                  // auto-rotate from EXIF orientation
      .jpeg({ quality: 82 })
      .toBuffer();

    try { await fs.promises.writeFile(cachePath, thumb); } catch { /* non-fatal */ }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', thumb.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.end(thumb);

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error';
    res.status(400).json({ error: msg });
  }
}
