import fs from 'fs';
import type { NextApiRequest, NextApiResponse } from 'next';
import { pipeline } from 'stream/promises';
import { backupConfig } from '@/lib/backup';
import { backupPath, downloadStream, listBackups, makeBackup, restore, uploadTemp } from '@/lib/backupCore';
import { allow, one } from '@/lib/opsApi';

/**
 * GET: the saved copies. GET ?download=1: everything as a .tar, or ?download=<name> for one copy.
 * POST ?action=save: save one now. POST ?action=restore with the file as the body, or &name= for a saved copy.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await allow(req, res, ['admin']))) return;
  const dl = one(req.query.download), action = one(req.query.action), name = one(req.query.name);
  if (req.method === 'GET' && !dl) return res.json({ backups: listBackups(backupConfig), folder: backupConfig.dir });
  if (req.method === 'GET' && dl !== '1') {
    const p = backupPath(backupConfig, dl);
    if (!p) return res.status(404).json({ error: 'Backup not found' });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${dl.replace(/\.backup$/, '.json')}"`);
    return void fs.createReadStream(p).pipe(res);
  }
  if (req.method === 'GET') {
    const { stream, filename } = await downloadStream(backupConfig);
    res.setHeader('Content-Type', 'application/x-tar');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return void stream.pipe(res);
  }
  if (req.method !== 'POST') return res.status(405).end();
  if (action === 'save') return res.json(await makeBackup(backupConfig, 'manual'));
  if (action !== 'restore') return res.status(400).json({ error: 'Unknown action' });
  let file: string | null = null, temp = false;
  try {
    if (name) {
      file = backupPath(backupConfig, name);
      if (!file) return res.status(404).json({ error: 'Backup not found' });
    } else {
      file = uploadTemp(backupConfig.app); temp = true;
      await pipeline(req, fs.createWriteStream(file));
      if (fs.statSync(file).size < 10) return res.status(400).json({ error: 'That file is empty' });
    }
    try { res.json({ ok: true, ...(await restore(backupConfig, file)) }); }
    catch (e) { res.status(400).json({ error: (e as Error).message }); }
  } finally {
    if (temp && file) fs.rmSync(file, { force: true });
  }
}

// The restore upload is streamed to disk, not parsed.
export const config = { api: { bodyParser: false, responseLimit: false } };
