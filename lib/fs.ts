import path from 'path';
import fs from 'fs';

export const BASE_DIR = process.env.BASE_DIRECTORY
  ? path.resolve(process.env.BASE_DIRECTORY)
  : path.resolve(process.cwd(), 'data');

const isInside = (base: string, p: string) => p === base || p.startsWith(base + path.sep);

export function resolveSafePath(userPath: string): string {
  if (userPath != null && typeof userPath !== 'string') throw new Error('Invalid path');
  if ((userPath || '').includes('\0')) throw new Error('Invalid path');
  const cleaned = (userPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(BASE_DIR, cleaned);
  if (!isInside(BASE_DIR, resolved)) {
    throw new Error('Path traversal attempt blocked');
  }
  // A symlink inside the folder can still point outside it, so also check where the path really
  // leads. For a path that doesn't exist yet, check its nearest existing parent.
  if (fs.existsSync(BASE_DIR)) {
    let probe = resolved;
    while (probe !== BASE_DIR && !fs.existsSync(probe)) {
      let dangling = false;
      try { dangling = fs.lstatSync(probe).isSymbolicLink(); } catch { /* doesn't exist */ }
      if (dangling) throw new Error('Path traversal attempt blocked');
      probe = path.dirname(probe);
    }
    if (!isInside(fs.realpathSync(BASE_DIR), fs.realpathSync(probe))) {
      throw new Error('Path traversal attempt blocked');
    }
  }
  return resolved;
}

/** For deleting, moving, renaming or sharing: the same checks, and the root folder itself is refused. */
export function resolveEntryPath(userPath: string): string {
  const resolved = resolveSafePath(userPath);
  if (resolved === BASE_DIR) throw new Error("The root folder can't be changed");
  return resolved;
}

/** A single file or folder name. Blocks separators and the ".." that path.join would walk up through. */
export function isSafeName(name: unknown): name is string {
  return typeof name === 'string' && name.trim() !== '' && name !== '.' && name !== '..'
    && name.length <= 255 && !/[/\\\0]/.test(name);
}

/** A download filename header that keeps spaces and non-English names intact. */
export function contentDisposition(type: 'inline' | 'attachment', filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function toRelative(absolutePath: string): string {
  return path.relative(BASE_DIR, absolutePath).replace(/\\/g, '/');
}

export const IMAGE_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp', '.svg', '.heic', '.heif', '.avif',
  // RAW camera formats — served as JPEG previews via dcraw
  '.arw', '.cr2', '.cr3', '.nef', '.dng', '.raf', '.rw2', '.orf', '.pef', '.srw', '.raw',
]);

export const RAW_EXTS = new Set([
  '.arw', '.cr2', '.cr3', '.nef', '.dng', '.raf', '.rw2', '.orf', '.pef', '.srw', '.raw',
]);
export const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv']);
export const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a', '.opus']);
export const TEXT_EXTS = new Set([
  '.txt', '.md', '.py', '.json', '.html', '.css', '.js', '.ts', '.tsx', '.jsx',
  '.csv', '.xml', '.yml', '.yaml', '.ini', '.log', '.bat', '.sh', '.env',
  '.gitignore', '.dockerfile', '.toml', '.rs', '.go', '.java', '.c', '.cpp', '.h',
]);

export type FileType = 'image' | 'video' | 'audio' | 'text' | 'pdf' | 'archive' | 'other';

export function getFileType(filename: string): FileType {
  const ext = path.extname(filename).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  if (TEXT_EXTS.has(ext)) return 'text';
  if (ext === '.pdf') return 'pdf';
  if (['.zip', '.rar', '.tar', '.gz', '.7z', '.bz2', '.xz'].includes(ext)) return 'archive';
  return 'other';
}

export function detectImageFolder(files: { name: string; isDir: boolean }[]): boolean {
  const nonDir = files.filter((f) => !f.isDir);
  if (nonDir.length === 0) return false;
  const imgs = nonDir.filter((f) =>
    IMAGE_EXTS.has(path.extname(f.name).toLowerCase())
  ).length;
  return imgs / nonDir.length > 0.5;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function ensureBaseDir() {
  if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
  }
}

export function getUniquePath(targetPath: string): string {
  if (!fs.existsSync(targetPath)) return targetPath;
  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);
  let i = 1;
  while (fs.existsSync(path.join(dir, `${base} (${i})${ext}`))) i++;
  return path.join(dir, `${base} (${i})${ext}`);
}

/** Copies without blocking other requests. Refuses to copy a folder into itself, which would never end. */
export async function copyRecursive(src: string, dest: string): Promise<void> {
  if (isInside(src, dest)) throw new Error("Can't copy a folder into itself");
  const stat = await fs.promises.lstat(src);
  if (stat.isSymbolicLink()) return;
  if (stat.isDirectory()) {
    await fs.promises.mkdir(dest, { recursive: true });
    for (const child of await fs.promises.readdir(src)) {
      await copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    await fs.promises.copyFile(src, dest);
  }
}
