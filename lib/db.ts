/**
 * Pure JSON file-based data store — no native compilation required.
 * Stores users, temp shares, and site config in config/data.json
 */
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export interface User {
  id: number;
  username: string;
  password: string;
  role: 'admin' | 'mod' | 'user';
  created_at: string;
}

export interface TempShare {
  token: string;
  filepath: string;
  expires_at: string;
  created_at: string;
}

interface DbData {
  users: User[];
  tempShares: TempShare[];
  config: Record<string, string>;
  nextUserId: number;
}

// ── Storage path ────────────────────────────────────────────────────────────

const dbDir = process.env.DATABASE_PATH
  ? path.dirname(process.env.DATABASE_PATH)
  : path.join(process.cwd(), 'config');

const dbFile = path.join(dbDir, 'data.json');

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// ── Read / Write ─────────────────────────────────────────────────────────────

function read(): DbData {
  try {
    return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  } catch {
    return { users: [], tempShares: [], config: {}, nextUserId: 1 };
  }
}

function write(data: DbData): void {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf8');
}

// ── Initialise ───────────────────────────────────────────────────────────────

function init() {
  const data = read();
  let changed = false;

  // Seed site config
  if (!data.config['site_name']) {
    data.config['site_name'] = process.env.SITE_NAME || 'SkyBit';
    changed = true;
  }

  // Migrate legacy users.json
  const legacyPath = path.join(dbDir, 'users.json');
  if (fs.existsSync(legacyPath)) {
    try {
      const legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf8')) as Record<
        string, { password: string; role: string }
      >;
      for (const [username, info] of Object.entries(legacy)) {
        if (!data.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
          data.users.push({
            id: data.nextUserId++,
            username,
            password: info.password,
            role: (info.role as User['role']) || 'user',
            created_at: new Date().toISOString(),
          });
        }
      }
      fs.renameSync(legacyPath, legacyPath + '.migrated');
      changed = true;
      console.log('[SkyBit] Migrated users.json → data.json');
    } catch { /* silent */ }
  }

  // Create default admin if no users exist
  if (data.users.length === 0) {
    data.users.push({
      id: data.nextUserId++,
      username: 'admin',
      password: bcrypt.hashSync('admin', 12),
      role: 'admin',
      created_at: new Date().toISOString(),
    });
    changed = true;
    console.log('[SkyBit] Created default admin (username: admin, password: admin) — change this immediately!');
  }

  if (changed) write(data);
}

init();

// ── Users API ─────────────────────────────────────────────────────────────────

export function getUserByUsername(username: string): User | undefined {
  return read().users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

export function getUserById(id: number): User | undefined {
  return read().users.find(u => u.id === id);
}

export function listUsers(): Omit<User, 'password'>[] {
  return read().users.map(({ password: _p, ...u }) => u);
}

export function countUsers(): number {
  return read().users.length;
}

export function createUser(username: string, password: string, role: User['role']): void {
  const data = read();
  if (data.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('Username already exists');
  }
  data.users.push({ id: data.nextUserId++, username: username.trim(), password, role, created_at: new Date().toISOString() });
  write(data);
}

export function updateUser(
  id: number,
  updates: { username?: string; password?: string; role?: User['role'] }
): void {
  const data = read();
  const idx = data.users.findIndex(u => u.id === id);
  if (idx === -1) throw new Error('User not found');
  if (updates.username) {
    if (data.users.find(u => u.username.toLowerCase() === updates.username!.toLowerCase() && u.id !== id)) {
      throw new Error('Username already taken');
    }
    data.users[idx].username = updates.username.trim();
  }
  if (updates.password) data.users[idx].password = updates.password;
  if (updates.role) data.users[idx].role = updates.role;
  write(data);
}

export function deleteUser(id: number): void {
  const data = read();
  data.users = data.users.filter(u => u.id !== id);
  write(data);
}

// ── Temp Shares API ───────────────────────────────────────────────────────────

export function createShare(token: string, filepath: string, expiresAt: string): void {
  const data = read();
  data.tempShares.push({ token, filepath, expires_at: expiresAt, created_at: new Date().toISOString() });
  write(data);
}

export function getShare(token: string): TempShare | undefined {
  return read().tempShares.find(s => s.token === token);
}

export function listShares(): TempShare[] {
  const now = new Date().toISOString();
  return read().tempShares.filter(s => s.expires_at > now);
}

export function updateShare(token: string, expiresAt: string): void {
  const data = read();
  const s = data.tempShares.find(s => s.token === token);
  if (s) { s.expires_at = expiresAt; write(data); }
}

export function deleteShare(token: string): void {
  const data = read();
  data.tempShares = data.tempShares.filter(s => s.token !== token);
  write(data);
}

export function cleanupExpiredShares(): void {
  const data = read();
  const now = new Date().toISOString();
  data.tempShares = data.tempShares.filter(s => s.expires_at > now);
  write(data);
}

// ── Config API ────────────────────────────────────────────────────────────────

export function getConfig(key: string): string | undefined {
  return read().config[key];
}

export function setConfig(key: string, value: string): void {
  const data = read();
  data.config[key] = value;
  write(data);
}
