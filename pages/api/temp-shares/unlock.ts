import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { getShare } from '@/lib/db';
import { getSession } from '@/lib/session';
import { checkCsrf } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/clientIp';

/** POST { token, password }: unlocks a password-protected link for this browser. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ error: 'Forbidden' });
  const { token, password } = (req.body ?? {}) as { token?: unknown; password?: unknown };
  if (typeof token !== 'string' || typeof password !== 'string' || !token || !password) {
    return res.status(400).json({ error: 'Enter the password' });
  }
  // Slow guessing down, per address and per link.
  if (!checkRateLimit(`share-unlock:${clientIp(req)}`, 10, 60_000) || !checkRateLimit(`share-unlock-t:${token}`, 30, 10 * 60_000)) {
    return res.status(429).json({ error: 'Too many tries. Wait a minute.' });
  }
  const share = getShare(token);
  if (!share || new Date(share.expires_at) < new Date()) return res.status(404).json({ error: 'That link has expired or was removed' });
  if (!share.passwordHash) return res.json({ ok: true });
  if (!(await bcrypt.compare(password, share.passwordHash))) return res.status(401).json({ error: 'Wrong password' });
  const session = await getSession(req, res);
  session.unlockedShares = [...(session.unlockedShares ?? []).filter(t => t !== token), token].slice(-20);
  await session.save();
  res.json({ ok: true });
}
