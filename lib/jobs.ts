export interface Job {
  id: string;
  type: 'copy' | 'move';
  label: string;
  status: 'running' | 'done' | 'error';
  error?: string;
  createdAt: number;
}

// Module-level map — persists across requests in the same Node process
const jobs = new Map<string, Job>();

export function createJob(type: Job['type'], label: string): Job {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const job: Job = { id, type, label, status: 'running', createdAt: Date.now() };
  jobs.set(id, job);
  // Clean jobs older than 10 minutes every time we create a new one
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [jid, j] of jobs.entries()) {
    if (j.status !== 'running' && j.createdAt < cutoff) jobs.delete(jid);
  }
  return job;
}

export function updateJob(id: string, patch: Partial<Job>) {
  const j = jobs.get(id);
  if (j) jobs.set(id, { ...j, ...patch });
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}
