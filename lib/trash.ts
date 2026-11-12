// The trash: deleting moves things into a hidden folder inside the files folder, where they wait 30 days.
// Moving within one folder tree is instant, even for huge files. Anyone who can delete can restore.
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { readData, updateData, type TrashItem } from './db';
import { BASE_DIR, TRASH_DIR, copyRecursive, getUniquePath, resolveSafePath, toRelative } from './fs';

export const KEEP_DAYS = 30;

/** Moves a file or folder (an absolute path from resolveEntryPath) into the trash. */
export async function moveToTrash(resolved: string, deletedBy: string): Promise<TrashItem> {
  const stat = fs.statSync(resolved);
  const id = randomUUID();
  const dir = path.join(TRASH_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, path.basename(resolved));
  try {
    fs.renameSync(resolved, dest);
  } catch (e) {
    // A folder mounted from another disk can't be renamed across; copy it, then remove the original.
    if ((e as NodeJS.ErrnoException).code !== 'EXDEV') { fs.rmSync(dir, { recursive: true, force: true }); throw e; }
    await copyRecursive(resolved, dest);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
  const item: TrashItem = {
    id, name: path.basename(resolved), from: toRelative(resolved), isDir: stat.isDirectory(),
    size: stat.isDirectory() ? null : stat.size, deletedAt: new Date().toISOString(), deletedBy,
  };
  updateData(d => { d.trash = [...(d.trash ?? []), item]; });
  return item;
}

export function listTrash(): TrashItem[] {
  return [...(readData().trash ?? [])].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

const itemPath = (t: TrashItem) => path.join(TRASH_DIR, t.id, t.name);

/** Puts it back where it was. If something new has taken its name, it comes back as "name (1)". */
export function restoreFromTrash(id: string): string {
  const t = (readData().trash ?? []).find(x => x.id === id);
  if (!t) throw new Error('Not in the trash');
  const src = itemPath(t);
  if (!fs.existsSync(src)) { forget(id); throw new Error('That item is gone from the trash folder'); }
  const wanted = resolveSafePath(t.from);
  fs.mkdirSync(path.dirname(wanted), { recursive: true });
  const dest = getUniquePath(wanted);
  fs.renameSync(src, dest);
  fs.rmSync(path.join(TRASH_DIR, id), { recursive: true, force: true });
  forget(id);
  return toRelative(dest);
}

function forget(id: string) {
  updateData(d => { d.trash = (d.trash ?? []).filter(x => x.id !== id); });
}

export function deleteForever(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Not in the trash');
  fs.rmSync(path.join(TRASH_DIR, id), { recursive: true, force: true });
  forget(id);
}

export function emptyTrash(): number {
  const all = readData().trash ?? [];
  for (const t of all) fs.rmSync(path.join(TRASH_DIR, t.id), { recursive: true, force: true });
  updateData(d => { d.trash = []; });
  return all.length;
}

/** From the hourly job: removes anything older than 30 days, and leftovers nothing points to. */
export function purgeOldTrash(now = Date.now()) {
  const cutoff = new Date(now - KEEP_DAYS * 86400_000).toISOString();
  const all = readData().trash ?? [];
  for (const t of all.filter(x => x.deletedAt < cutoff)) deleteForever(t.id);
  if (fs.existsSync(TRASH_DIR)) {
    const known = new Set((readData().trash ?? []).map(t => t.id));
    for (const n of fs.readdirSync(TRASH_DIR)) if (!known.has(n)) fs.rmSync(path.join(TRASH_DIR, n), { recursive: true, force: true });
  }
}

export const trashExists = () => fs.existsSync(TRASH_DIR) && TRASH_DIR.startsWith(BASE_DIR);
