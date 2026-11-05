import type { NextApiRequest, NextApiResponse } from 'next';
import { checkCsrf } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { resolveSafePath, getUniquePath, isSafeName } from '@/lib/fs';
import Busboy from 'busboy';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

export const config = { api: { bodyParser: false, responseLimit: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ error: 'Forbidden' });

  const session = await getSession(req, res);
  if (!session.userId || !['admin', 'mod'].includes(session.role!)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const folder = (req.query.folder as string) || '';
  let destDir: string;
  try {
    destDir = resolveSafePath(folder);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  } catch {
    return res.status(400).json({ error: 'Invalid folder' });
  }

  const uploads: string[] = [];
  const errors: string[] = [];
  const writes: Promise<void>[] = [];

  let bb: ReturnType<typeof Busboy>;
  try {
    bb = Busboy({ headers: req.headers });
  } catch {
    return res.status(400).json({ error: 'Expected a file upload' });
  }

  await new Promise<void>((resolve) => {
    bb.on('file', (_field, file, info) => {
      const filename = path.basename((info.filename || '').replace(/\\/g, '/'));
      if (!isSafeName(filename)) {
        if (info.filename) errors.push('Invalid file name');
        file.resume();
        return;
      }
      const destPath = getUniquePath(path.join(destDir, filename));
      const part = `${destPath}.part`;
      // Written under a temporary name, so a dropped connection doesn't leave half a file looking finished.
      writes.push(
        pipeline(file, fs.createWriteStream(part, { flags: 'wx' }))
          .then(() => fs.promises.rename(part, destPath))
          .then(() => { uploads.push(path.basename(destPath)); })
          .catch(async (err) => {
            errors.push(err instanceof Error ? err.message : String(err));
            await fs.promises.unlink(part).catch(() => {});
          }),
      );
    });

    bb.on('finish', resolve);
    bb.on('error', (err: unknown) => { errors.push(err instanceof Error ? err.message : String(err)); resolve(); });
    // The browser cancelling must not leave this request (and its open files) waiting forever.
    req.on('aborted', () => { bb.destroy(new Error('Upload cancelled')); resolve(); });
    req.pipe(bb);
  });

  await Promise.all(writes);
  if (res.destroyed) return;
  res.json({ uploaded: uploads, errors });
}
