import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { checkCsrf } from '@/lib/csrf';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ error: 'Forbidden' });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.destroy();
  res.json({ ok: true });
}
