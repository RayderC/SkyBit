'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DeleteModal from '@/components/DeleteModal';

interface User { id: number; username: string; role: string; created_at: string; }

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [me, setMe] = useState<{ id: number; username: string; role: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch('/api/auth/user').then(r => {
      if (!r.ok) { router.push('/login'); return null; }
      return r.json();
    }).then(u => {
      if (u && u.role !== 'admin') router.push('/');
      if (u) { setMe(u); loadUsers(); }
    });
  }, [router]);

  function loadUsers() {
    fetch('/api/users/list').then(r => r.json()).then(setUsers);
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/users/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: fd.get('username'), password: fd.get('password'), role: fd.get('role') }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setSuccess('User added'); setShowAdd(false); loadUsers();
    (e.target as HTMLFormElement).reset();
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch('/api/users/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editUser!.id,
        username: fd.get('username') || undefined,
        password: fd.get('password') || undefined,
        role: fd.get('role') || undefined,
      }),
    });
    setSuccess('User updated'); setEditUser(null); loadUsers();
  }

  async function handleDelete() {
    await fetch('/api/users/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deleteUser!.id }),
    });
    setDeleteUser(null); loadUsers();
  }

  const ROLES = ['admin', 'mod', 'user'];

  return (
    <div className="page-root">
      <div className="page-header">
        <h1 className="page-title">User Management</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/admin/temp-shares" className="btn btn-secondary btn-sm">Temp Shares</a>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>
            + Add User
          </button>
        </div>
      </div>

      {error && <div className="flash flash-error" onClick={() => setError('')}>{error}</div>}
      {success && <div className="flash flash-success" onClick={() => setSuccess('')}>{success}</div>}

      {showAdd && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16, fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>New User</h3>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: '1 1 160px' }}>
              <label className="form-label">Username</label>
              <input name="username" className="form-input" required />
            </div>
            <div className="form-group" style={{ flex: '1 1 160px' }}>
              <label className="form-label">Password</label>
              <input name="password" type="password" className="form-input" required />
            </div>
            <div className="form-group" style={{ flex: '1 1 120px' }}>
              <label className="form-label">Role</label>
              <select name="role" className="form-input form-select" defaultValue="user">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, paddingBottom: 2 }}>
              <button type="submit" className="btn btn-primary btn-sm">Create</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}>
                  {u.username}
                  {u.id === me?.id && (
                    <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--primary-light)', background: 'var(--primary-glow)', padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(168,85,247,0.3)' }}>you</span>
                  )}
                </td>
                <td>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.75rem', textTransform: 'uppercase',
                    color: u.role === 'admin' ? 'var(--primary-light)' : u.role === 'mod' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    background: u.role === 'admin' ? 'var(--primary-glow)' : 'var(--surface-2)',
                    padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border-bright)',
                  }}>{u.role}</span>
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditUser(u)}>Edit</button>
                    {u.id !== me?.id && (
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteUser(u)}>Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Edit {editUser.username}</h3>
            <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">New Username (leave blank to keep)</label>
                <input name="username" className="form-input" placeholder={editUser.username} />
              </div>
              <div className="form-group">
                <label className="form-label">New Password (leave blank to keep)</label>
                <input name="password" type="password" className="form-input" placeholder="New password" />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select name="role" className="form-input form-select" defaultValue={editUser.role}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEditUser(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteUser && (
        <DeleteModal
          items={[`user "${deleteUser.username}"`]}
          message={`Are you sure you want to delete the user "${deleteUser.username}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteUser(null)}
        />
      )}
    </div>
  );
}
