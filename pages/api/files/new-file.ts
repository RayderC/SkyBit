import type { NextApiRequest, NextApiResponse } from 'next';
import { checkCsrf } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { resolveSafePath, getUniquePath, isSafeName } from '@/lib/fs';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ error: 'Forbidden' });

  const session = await getSession(req, res);
  if (!session.userId || !['admin', 'mod'].includes(session.role!)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { folder, name } = req.body as { folder?: string; name?: string };
  if (!isSafeName(name)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  try {
    const dir = resolveSafePath(folder || '');
    if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Folder not found' });
    const destPath = getUniquePath(path.join(dir, name.trim()));
    fs.writeFileSync(destPath, '');
    res.json({ name: path.basename(destPath) });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' });
  }
}
