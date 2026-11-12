'use client';

import { useCallback, useEffect, useState } from 'react';

type Item = { id: string; name: string; from: string; isDir: boolean; size: number | null; deletedAt: string; deletedBy: string };

const size = (b: number | null) => (b == null ? 'Folder' : b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : b < 1024 ** 3 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024 ** 3).toFixed(2)} GB`);
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const daysLeft = (iso: string, keep: number) => Math.max(0, Math.ceil(keep - (Date.now() - new Date(iso).getTime()) / 86400_000));
const parent = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');

/** Deleted files and folders, kept 30 days. Restore puts each one back where it was. */
export default function TrashPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [keep, setKeep] = useState(30);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/trash');
    if (r.status === 401) { location.href = '/login'; return; }
    const j = await r.json();
    if (!r.ok) { setError(j.error || 'Only admins and mods can open the trash'); setItems([]); return; }
    setItems(j.items); setKeep(j.keepDays);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(body: object, done: string) {
    setError(''); setNote('');
    const r = await fetch('/api/trash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError(j.error || 'That didn’t work');
    else setNote(typeof j.path === 'string' ? `Restored to /${j.path}` : done);
    load();
  }

  return (
    <div className="page-root">
      <div className="page-header">
        <h1 className="page-title">Trash</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="/" className="btn btn-ghost btn-sm">← Files</a>
          {items && items.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={() => { if (confirm(`Delete all ${items.length} items in the trash for good? This can't be undone.`)) act({ action: 'empty' }, 'Trash emptied.'); }}>Empty trash</button>
          )}
        </div>
      </div>
      <p className="ops-hint">Deleted files and folders wait here for {keep} days, then they&apos;re gone for good. Restore puts one back where it was.</p>
      {error && <div className="flash flash-error" onClick={() => setError('')}>{error}</div>}
      {note && <div className="flash flash-success" onClick={() => setNote('')}>{note}</div>}
      {!items ? <p className="ops-hint">Loading…</p> : items.length === 0 ? (
        <div className="card"><p className="ops-hint" style={{ margin: 0 }}>The trash is empty.</p></div>
      ) : (
        <div className="trash-list">
          {items.map(t => (
            <div key={t.id} className="card trash-item" data-trash={t.name}>
              <div className="trash-main">
                <span className="trash-name">{t.isDir ? '📁' : '📄'} {t.name}</span>
                <span className="ops-muted">From /{parent(t.from)} · {size(t.size)} · deleted {when(t.deletedAt)}{t.deletedBy ? ` by ${t.deletedBy}` : ''} · {daysLeft(t.deletedAt, keep)} days left</span>
              </div>
              <div className="ops-actions">
                <button className="btn btn-primary btn-sm" onClick={() => act({ action: 'restore', id: t.id }, 'Restored.')}>Restore</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm(`Delete ${t.name} for good?`)) act({ action: 'delete', id: t.id }, 'Deleted for good.'); }}>Delete for good</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
