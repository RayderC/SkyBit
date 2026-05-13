import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { resolveSafePath } from '@/lib/fs';
import fs from 'fs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId || !['admin', 'mod'].includes(session.role!)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { paths } = req.body as { paths: string[] };
  if (!Array.isArray(paths)) return res.status(400).json({ error: 'paths must be an array' });

  const errors: string[] = [];
  for (const p of paths) {
    try {
      const resolved = resolveSafePath(p);
      if (fs.existsSync(resolved)) fs.rmSync(resolved, { recursive: true, force: true });
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  res.json({ ok: errors.length === 0, errors });
}
