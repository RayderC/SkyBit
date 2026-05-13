import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { BASE_DIR, ensureBaseDir } from '@/lib/fs';
import fs from 'fs';
import path from 'path';

interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
}

function buildTree(dir: string, relBase: string, depth = 0): FolderNode[] {
  if (depth > 6) return [];
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => {
        const fullPath = path.join(dir, e.name);
        const relPath = path.join(relBase, e.name).replace(/\\/g, '/');
        return {
          name: e.name,
          path: relPath,
          children: buildTree(fullPath, relPath, depth + 1),
        };
      });
  } catch {
    return [];
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId) return res.status(401).json({ error: 'Unauthorized' });

  ensureBaseDir();

  const tree: FolderNode = {
    name: 'Home',
    path: '',
    children: buildTree(BASE_DIR, ''),
  };

  res.json(tree);
}
