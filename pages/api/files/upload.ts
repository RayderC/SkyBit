import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { resolveSafePath, getUniquePath } from '@/lib/fs';
import Busboy from 'busboy';
import fs from 'fs';
import path from 'path';

export const config = { api: { bodyParser: false, responseLimit: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId || !['admin', 'mod'].includes(session.role!)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const folder = (req.query.folder as string) || '';
  let destDir: string;
  try {
    destDir = resolveSafePath(folder);
  } catch {
    return res.status(400).json({ error: 'Invalid folder' });
  }

  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const bb = Busboy({ headers: req.headers });
  const uploads: string[] = [];
  const errors: string[] = [];

  await new Promise<void>((resolve) => {
    bb.on('file', (fieldname, file, info) => {
      const { filename } = info;
      if (!filename) { file.resume(); return; }

      // Preserve relative path for folder uploads (webkitRelativePath)
      const relativePath = fieldname === 'folder_path' ? filename : path.basename(filename);
      const destPath = getUniquePath(path.join(destDir, relativePath));
      const dir = path.dirname(destPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const writeStream = fs.createWriteStream(destPath);
      file.pipe(writeStream);
      writeStream.on('finish', () => uploads.push(path.basename(destPath)));
      writeStream.on('error', (err) => errors.push(err.message));
    });

    bb.on('finish', resolve);
    bb.on('error', (err: unknown) => { errors.push(err instanceof Error ? err.message : String(err)); resolve(); });
    req.pipe(bb);
  });

  res.json({ uploaded: uploads, errors });
}
