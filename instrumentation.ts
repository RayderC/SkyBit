// Runs once when the server starts: each hour, the nightly backup, emptying 30-day-old trash, and the update check.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const g = globalThis as unknown as { __skybitJobs?: boolean };
  if (g.__skybitJobs) return;
  g.__skybitJobs = true;
  const run = async () => {
    const [{ nightlyBackup }, { backupConfig }, { purgeOldTrash }, { checkForUpdate }] = await Promise.all([
      import('./lib/backupCore'), import('./lib/backup'), import('./lib/trash'), import('./lib/updateCore'),
    ]);
    await nightlyBackup(backupConfig).catch(e => console.error('[backup] nightly copy failed', e));
    try { purgeOldTrash(); } catch (e) { console.error('[trash] cleanup failed', e); }
    await checkForUpdate('rayderc/skybit');
  };
  setTimeout(run, 60_000).unref();
  setInterval(run, 60 * 60 * 1000).unref();
}
