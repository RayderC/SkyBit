import type { NextApiRequest, NextApiResponse } from 'next';
import { checkCsrf } from '@/lib/csrf';
import { getSession } from '@/lib/session';
import { resolveSafePath } from '@/lib/fs';
import fs from 'fs';

// Matches the largest file the preview page will open for editing.
export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ error: 'Forbidden' });
  const session = await getSession(req, res);
  if (!session.userId || !['admin', 'mod'].includes(session.role!)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { path: filePath, content } = req.body as { path: string; content: string };
  if (typeof content !== 'string') return res.status(400).json({ error: 'Invalid content' });
  try {
    const resolved = resolveSafePath(filePath);
    fs.writeFileSync(resolved, content, 'utf8');
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' });
  }
}
