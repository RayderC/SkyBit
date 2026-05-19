import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { getJob } from '@/lib/jobs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId) return res.status(403).json({ error: 'Forbidden' });

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const job = getJob(id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.json(job);
}
