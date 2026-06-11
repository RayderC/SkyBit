'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function ShareContent() {
  const params = useSearchParams();
  const token = params?.get('token') || '';
  const downloadUrl = `/api/temp-shares/access?token=${token}&dl=1`;

  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/temp-shares/info?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setFilename(data.filename);
      })
      .catch(() => setError('Could not load share info.'));
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo" style={{ fontSize: '1.4rem' }}>SkyBit</div>
        <p className="auth-subtitle">{'// shared file'}</p>

        {error ? (
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

        {!error && (
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
