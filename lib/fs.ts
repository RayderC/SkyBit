import path from 'path';
import fs from 'fs';

export const BASE_DIR = process.env.BASE_DIRECTORY
  ? path.resolve(process.env.BASE_DIRECTORY)
  : path.resolve(process.cwd(), 'data');

export function resolveSafePath(userPath: string): string {
  const cleaned = (userPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(BASE_DIR, cleaned);
  if (!resolved.startsWith(BASE_DIR + path.sep) && resolved !== BASE_DIR) {
    throw new Error('Path traversal attempt blocked');
  }
  return resolved;
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

export function copyRecursive(src: string, dest: string) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}
