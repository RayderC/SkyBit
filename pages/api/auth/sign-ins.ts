import type { NextApiRequest, NextApiResponse } from 'next';
import { bumpTokenVersion } from '@/lib/db';
import { allow } from '@/lib/opsApi';
import { listSignIns } from '@/lib/signIns';

/** GET: your recent sign-ins. POST: sign out every other device and keep this one. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await allow(req, res);
  if (!session) return;
  if (req.method === 'GET') return res.json(listSignIns(session.userId!));
  if (req.method !== 'POST') return res.status(405).end();
  session.tokenVersion = bumpTokenVersion(session.userId!);
  await session.save();
  res.json({ ok: true });
}
