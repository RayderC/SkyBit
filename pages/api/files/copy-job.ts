import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { resolveSafePath, getUniquePath, copyRecursive } from '@/lib/fs';
import { createJob, updateJob } from '@/lib/jobs';
import path from 'path';
import fs from 'fs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId || !['admin', 'mod'].includes(session.role!)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { paths, dest, label } = req.body as { paths: string[]; dest: string; label: string };
  if (!Array.isArray(paths) || !dest) return res.status(400).json({ error: 'Missing params' });

  const job = createJob('copy', label || `Copy ${paths.length} item${paths.length !== 1 ? 's' : ''}`);

  // Respond immediately so the UI is unblocked
  res.status(202).json({ jobId: job.id });

  // Run the actual copy work after the response
  setImmediate(async () => {
    try {
      const destDir = resolveSafePath(dest);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      for (const p of paths) {
        const srcPath = resolveSafePath(p);
        const destPath = getUniquePath(path.join(destDir, path.basename(srcPath)));
        copyRecursive(srcPath, destPath);
      }
      updateJob(job.id, { status: 'done' });
    } catch (e) {
      updateJob(job.id, { status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  });
}
