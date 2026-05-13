'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ShareContent() {
  const params = useSearchParams();
  const token = params?.get('token') || '';
  const downloadUrl = `/api/temp-shares/access?token=${token}`;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo" style={{ fontSize: '1.4rem' }}>SkyBit</div>
        <p className="auth-subtitle">// shared file</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 24, textAlign: 'center' }}>
          Click the button below to download your shared file.
        </p>
        <a href={downloadUrl} download className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
          Download File
        </a>
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
