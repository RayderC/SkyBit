// Sign-in history, kept in data.json, the last 50 per person.
import type { NextApiRequest } from 'next';
import { clientIp } from './clientIp';
import { readData, updateData } from './db';
import { describeAgent } from './updateCore';

export type SignIn = { at: string; ip: string | null; device: string; ok: boolean };

export function recordSignIn(userId: number, req: NextApiRequest, ok = true) {
  try {
    const ip = clientIp(req);
    updateData(d => {
      const all = [...(d.signIns ?? []), { userId, at: new Date().toISOString(), ip: ip && ip !== 'unknown' && ip !== 'local' ? ip : null, device: describeAgent(req.headers['user-agent']), ok }];
      const mine = all.filter(s => s.userId === userId);
      const drop = new Set(mine.slice(0, Math.max(0, mine.length - 50)));
      d.signIns = all.filter(s => !drop.has(s));
    });
  } catch (e) {
    console.warn('[sign-ins]', (e as Error).message);
  }
}

export function listSignIns(userId: number, limit = 20): SignIn[] {
  return (readData().signIns ?? []).filter(s => s.userId === userId).slice(-limit).reverse()
    .map(({ at, ip, device, ok }) => ({ at, ip, device, ok }));
}
