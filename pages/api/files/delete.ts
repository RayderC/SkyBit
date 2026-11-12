import type { NextApiRequest, NextApiResponse } from 'next';
import { checkCsrf } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { resolveEntryPath } from '@/lib/fs';
import fs from 'fs';
import { moveToTrash } from '@/lib/trash';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ error: 'Forbidden' });
  const session = await getSession(req, res);
  if (!session.userId || !['admin', 'mod'].includes(session.role!)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { path: filePath } = req.body as { path: string };
  try {
    const resolved = resolveEntryPath(filePath);
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Not found' });
    await moveToTrash(resolved, session.username ?? '');
    res.json({ ok: true, trashed: true });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' });
  }
}
