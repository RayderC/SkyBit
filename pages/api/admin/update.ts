import type { NextApiRequest, NextApiResponse } from 'next';
import { allow, one } from '@/lib/opsApi';
import { checkForUpdate } from '@/lib/updateCore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!(await allow(req, res, ['admin']))) return;
  res.json(await checkForUpdate('rayderc/skybit', one(req.query.force) === '1'));
}
