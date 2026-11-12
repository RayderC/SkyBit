// SkyBit's backups: data.json (accounts, share links, the trash list, settings). Your files themselves are
// too big to copy every night; back up the files folder your own way. See lib/backupCore.ts.
import fs from 'fs';
import path from 'path';
import { DATA_FILE } from './db';
import type { BackupConfig } from './backupCore';

export const backupConfig: BackupConfig = {
  app: 'skybit',
  dir: process.env.BACKUP_DIR || path.join(path.dirname(DATA_FILE), 'backups'),
  dbName: 'data.json',
  async snapshot(dest) { fs.copyFileSync(DATA_FILE, dest); },
  validate(file) {
    let d: { users?: { role?: string; username?: string }[]; tempShares?: unknown[] };
    try { d = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error("That isn't a SkyBit backup."); }
    if (!d || !Array.isArray(d.users) || !Array.isArray(d.tempShares)) throw new Error("That isn't a SkyBit backup.");
    if (!d.users.some(u => u.role === 'admin')) throw new Error('That backup has no admin account, so nobody could manage it.');
  },
  async install(file) {
    // Write then rename, like every other change to data.json.
    const tmp = `${DATA_FILE}.restoring`;
    fs.copyFileSync(file, tmp);
    fs.renameSync(tmp, DATA_FILE);
  },
};
