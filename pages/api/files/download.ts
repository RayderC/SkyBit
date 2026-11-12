import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@/lib/session';
import { resolveSafePath, RAW_EXTS, contentDisposition, BASE_DIR, TRASH_NAME } from '@/lib/fs';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { ZipArchive } from 'archiver';

export const config = { api: { responseLimit: false } };

// Scan binary data for embedded JPEGs and return the largest one found.
// All modern RAW formats (ARW, CR2, NEF, DNG …) embed a JPEG preview
// at a known offset inside the file. JPEG entropy-coded data cannot
// contain 0xFF 0xD9 unless it is the actual End-Of-Image marker, so
// the first EOI found after each SOI is the true end of that JPEG.
const SOI = Buffer.from([0xff, 0xd8, 0xff]);
const EOI = Buffer.from([0xff, 0xd9]);

function extractLargestJpeg(data: Buffer): Buffer | null {
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
  return best && best.length > 50 * 1024 ? best : null;
}

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.avif': 'image/avif', '.bmp': 'image/bmp', '.tiff': 'image/tiff',
  '.heic': 'image/heic', '.heif': 'image/heif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.aac': 'audio/aac',
  '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.opus': 'audio/ogg',
  '.pdf': 'application/pdf',
};

// SVG is left out on purpose: it can contain script, and opening an uploaded one directly would
// run that script as whoever opened it. <img> tags still display it.
const INLINE = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.tiff', '.heic', '.heif',
  '.mp4', '.webm', '.mov', '.mkv', '.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a', '.opus', '.pdf',
]);

/** Parses a single-range header. Browsers need this to seek in video, and iOS won't play video without it. */
function parseRange(header: string | undefined, size: number): { start: number; end: number } | 'invalid' | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start: number;
  let end: number;
  if (m[1] === '') {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return 'invalid';
  return { start, end };
}

async function streamFile(res: NextApiResponse, file: string, opts?: { start: number; end: number }) {
  try {
    await pipeline(fs.createReadStream(file, opts), res);
  } catch (e) {
    // The browser closing the connection early (seeking, cancelling) is normal.
    if ((e as NodeJS.ErrnoException).code !== 'ERR_STREAM_PREMATURE_CLOSE') console.error('[download]', e);
    res.destroy();
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.userId) return res.status(401).json({ error: 'Unauthorized' });

  const filePath = (req.query.path as string) || '';

  try {
    const resolved = resolveSafePath(filePath);
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Not found' });

    const stat = fs.statSync(resolved);

    // ZIP download for directories
    if (stat.isDirectory()) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', contentDisposition('attachment', `${path.basename(resolved)}.zip`));
      const archive = new ZipArchive({ zlib: { level: 6 } });
      archive.on('error', (e) => { console.error('[download]', e); res.destroy(); });
      res.on('close', () => { if (!res.writableFinished) archive.abort(); });
      archive.pipe(res);
      // Downloading the whole root leaves the trash out.
      archive.directory(resolved, path.basename(resolved), (entry: { name: string }) =>
        resolved === BASE_DIR && entry.name.split('/').includes(TRASH_NAME) ? false : entry);
      await archive.finalize();
      return;
    }

    const ext = path.extname(resolved).toLowerCase();

    // RAW camera files: scan for the largest embedded JPEG preview
    if (RAW_EXTS.has(ext)) {
      try {
        const data = await fs.promises.readFile(resolved);
        const jpeg = extractLargestJpeg(data);
        if (jpeg) {
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Content-Disposition', contentDisposition('inline', `${path.basename(resolved, ext)}.jpg`));
          res.setHeader('Content-Length', jpeg.length);
          res.setHeader('Cache-Control', 'private, max-age=3600');
          res.end(jpeg);
          return;
        }
      } catch { /* fall through to raw download */ }
      // No embedded JPEG found — offer the file as a download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', contentDisposition('attachment', path.basename(resolved)));
      res.setHeader('Content-Length', stat.size);
      await streamFile(res, resolved);
      return;
    }

    const isInline = INLINE.has(ext);
    res.setHeader('Content-Disposition', contentDisposition(isInline ? 'inline' : 'attachment', path.basename(resolved)));
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    // Files are private, so shared caches like Cloudflare must never keep a copy.
    res.setHeader('Cache-Control', isInline ? 'private, max-age=3600' : 'no-cache');
    res.setHeader('Accept-Ranges', 'bytes');
    if (ext === '.svg') res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:");

    const range = parseRange(req.headers.range, stat.size);
    if (range === 'invalid') {
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      return res.status(416).end();
    }
    if (range) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`);
      res.setHeader('Content-Length', range.end - range.start + 1);
      await streamFile(res, resolved, range);
      return;
    }
    res.setHeader('Content-Length', stat.size);
    await streamFile(res, resolved);
  } catch (e: unknown) {
    if (res.headersSent) return void res.destroy();
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' });
  }
}
