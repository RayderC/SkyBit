// Shared checks for the trash, backup, update and sign-in routes.
import type { NextApiRequest, NextApiResponse } from 'next';
import { checkCsrf } from './csrf';
import { getSession } from './session';

/** The session if the person may use this route, else null after sending the error. `roles` empty means anyone signed in. */
export async function allow(req: NextApiRequest, res: NextApiResponse, roles: ('admin' | 'mod' | 'user')[] = []) {
  if (req.method !== 'GET' && !checkCsrf(req)) { res.status(403).json({ error: 'Forbidden' }); return null; }
  const session = await getSession(req, res);
  if (!session.userId) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  if (roles.length && !roles.includes(session.role!)) { res.status(403).json({ error: 'Forbidden' }); return null; }
  return session;
}

export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
