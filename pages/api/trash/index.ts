import type { NextApiRequest, NextApiResponse } from 'next';
import { allow } from '@/lib/opsApi';
import { deleteForever, emptyTrash, KEEP_DAYS, listTrash, restoreFromTrash } from '@/lib/trash';

/**
 * GET: what's in the trash. POST { action: "restore" | "delete", id } or { action: "empty" }.
 * Admins and mods, the people who can delete.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await allow(req, res, ['admin', 'mod']))) return;
  if (req.method === 'GET') return res.json({ items: listTrash(), keepDays: KEEP_DAYS });
  if (req.method !== 'POST') return res.status(405).end();
  const { action, id } = (req.body ?? {}) as { action?: string; id?: unknown };
  try {
    if (action === 'empty') return res.json({ ok: true, removed: emptyTrash() });
    if (typeof id !== 'string') return res.status(400).json({ error: 'Pick something in the trash' });
    if (action === 'restore') return res.json({ ok: true, path: restoreFromTrash(id) });
    if (action === 'delete') { deleteForever(id); return res.json({ ok: true }); }
    res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Error' });
  }
}
