'use client';
import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/user').then(r => {
      if (!r.ok) { router.push('/login'); return null; }
      return r.json();
    }).then(u => { if (u) setUser(u); });
  }, [router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    const username = fd.get('username') as string;
    const currentPassword = fd.get('currentPassword') as string;
    const newPassword = fd.get('newPassword') as string;
    if (username && username !== user?.username) body.username = username;
    if (newPassword) { body.currentPassword = currentPassword; body.newPassword = newPassword; }

    const res = await fetch('/api/users/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    setSuccess('Profile updated');
    const updated = await fetch('/api/auth/user').then(r => r.json());
    setUser(updated);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (!user) return null;

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-logo" style={{ fontSize: '1.4rem', marginBottom: 4 }}>{user.username}</div>
        <p className="auth-subtitle">
          <span style={{
            color: user.role === 'admin' ? 'var(--primary-light)' : user.role === 'mod' ? 'var(--accent-cyan)' : 'var(--text-muted)',
          }}>{'// '}{user.role}</span>
        </p>

        {error && <div className="flash flash-error">{error}</div>}
        {success && <div className="flash flash-success">{success}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input name="username" className="form-input" defaultValue={user.username} />
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <p className="form-label" style={{ marginBottom: 12 }}>Change Password</p>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label">Current Password</label>
              <input name="currentPassword" type="password" className="form-input" placeholder="Required to change password" />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input name="newPassword" type="password" className="form-input" placeholder="Leave blank to keep current" />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 16, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {user.role === 'admin' && (
            <Link href="/admin" className="btn btn-secondary btn-sm">User Management</Link>
          )}
          {user.role === 'admin' && (
            <Link href="/admin/temp-shares" className="btn btn-secondary btn-sm">Temp Shares</Link>
          )}
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}
