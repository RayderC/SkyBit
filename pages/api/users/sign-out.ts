import type { NextApiRequest, NextApiResponse } from 'next';
import { bumpTokenVersion, getUserById } from '@/lib/db';
import { allow } from '@/lib/opsApi';

/** POST { id }: an admin signs someone out of every device. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await allow(req, res, ['admin']);
  if (!session) return;
  const id = Number((req.body ?? {}).id);
  if (!Number.isInteger(id) || !getUserById(id)) return res.status(404).json({ error: 'User not found' });
  if (id === session.userId) return res.status(400).json({ error: 'Use your profile to sign out your other devices' });
  bumpTokenVersion(id);
  res.json({ ok: true });
}
