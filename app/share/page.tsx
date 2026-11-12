'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

function ShareContent() {
  const params = useSearchParams();
  const token = params?.get('token') || '';
  const downloadUrl = `/api/temp-shares/access?token=${encodeURIComponent(token)}&dl=1`;

  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [wrong, setWrong] = useState('');

  const load = useCallback(() => {
    if (!token) return;
    fetch(`/api/temp-shares/info?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else if (data.locked) setLocked(true);
        else { setLocked(false); setFilename(data.filename); }
      })
      .catch(() => setError('Could not load share info.'));
  }, [token]);
  useEffect(() => { load(); }, [load]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setWrong('');
    const r = await fetch('/api/temp-shares/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setWrong(j.error || 'That didn\u2019t work'); return; }
    setPassword('');
    load();
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo" style={{ fontSize: '1.4rem' }}>SkyBit</div>
        <p className="auth-subtitle">// shared file</p>

        {!error && locked ? (
          <form onSubmit={unlock} className="share-unlock">
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12, textAlign: 'center' }}>This link has a password. Ask whoever sent it.</p>
            <input className="form-input" type="password" aria-label="Link password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} autoFocus />
            {wrong && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: 8 }}>{wrong}</p>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} disabled={!password}>Unlock</button>
          </form>
        ) : error ? (
          <p style={{ color: 'var(--danger)', fontSize: '0.88rem', textAlign: 'center', marginBottom: 24 }}>
            {error}
          </p>
        ) : (
          <div style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-bright)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            marginBottom: 24,
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
              You are downloading
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', color: 'var(--text)', wordBreak: 'break-all' }}>
              {filename ?? '…'}
            </p>
          </div>
        )}

        {!error && !locked && (
          <a href={downloadUrl} download className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            Download File
          </a>
        )}
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense>
      <ShareContent />
    </Suspense>
  );
}
