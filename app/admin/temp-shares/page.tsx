'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Share { token: string; filepath: string; expires_at: string; created_at: string; }

export default function TempSharesPage() {
  const router = useRouter();
  const [shares, setShares] = useState<Share[]>([]);
  const [editShare, setEditShare] = useState<Share | null>(null);
  const [expiresIn, setExpiresIn] = useState(60);

  useEffect(() => {
    fetch('/api/auth/user').then(r => {
      if (!r.ok) { router.push('/login'); return null; }
      return r.json();
    }).then(u => {
      if (u && u.role !== 'admin') router.push('/');
      if (u) loadShares();
    });
  }, [router]);

  function loadShares() {
    fetch('/api/temp-shares/list').then(r => r.json()).then(setShares);
  }

  async function handleDelete(token: string) {
    await fetch('/api/temp-shares/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    loadShares();
  }

  async function handleEdit() {
    await fetch('/api/temp-shares/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: editShare!.token, expiresIn }),
    });
    setEditShare(null);
    loadShares();
  }

  const getShareUrl = (token: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}/api/temp-shares/access?token=${token}` : '';

  return (
    <div className="page-root">
      <div className="page-header">
        <h1 className="page-title">Temp Share Links</h1>
        <a href="/admin" className="btn btn-secondary btn-sm">← Users</a>
      </div>

      {shares.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          No active share links
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>File / Folder</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shares.map(s => {
                const expired = new Date(s.expires_at) < new Date();
                return (
                  <tr key={s.token}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.filepath}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: expired ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {new Date(s.expires_at).toLocaleString()}
                      {expired && ' (expired)'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => { navigator.clipboard?.writeText(getShareUrl(s.token)); }}
                        >Copy Link</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setEditShare(s); setExpiresIn(60); }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.token)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editShare && (
        <div className="modal-overlay" onClick={() => setEditShare(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Edit Expiry</h3>
            <p className="modal-body" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', marginBottom: 20 }}>{editShare.filepath}</p>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Extend by (minutes)</label>
              <input
                type="number"
                className="form-input"
                min={1}
                value={expiresIn}
                onChange={e => setExpiresIn(Number(e.target.value))}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditShare(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEdit}>Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
