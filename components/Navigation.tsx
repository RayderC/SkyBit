'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/user').then(r => {
      if (!r.ok) return null;
      return r.json();
    }).then(u => setUser(u));
  }, [pathname]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  if (!user) return null;

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-logo">SkyBit</Link>

        <div className="nav-links">
          <Link href="/" className={`nav-link ${pathname && (pathname === '/' || (!pathname.startsWith('/admin') && !pathname.startsWith('/profile') && !pathname.startsWith('/login') && !pathname.startsWith('/share'))) ? 'active' : ''}`}>
            Files
          </Link>
          {user.role === 'admin' && (
            <Link href="/admin" className={`nav-link ${pathname?.startsWith('/admin') ? 'active' : ''}`}>
              Admin
            </Link>
          )}
        </div>

        <div className="nav-spacer" />

        <div className="nav-user">
          <span className="nav-role-badge">{user.role}</span>
          <Link href="/profile" className="nav-link" style={{ padding: '6px 10px' }}>
            {user.username}
          </Link>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ fontSize: '0.78rem', padding: '5px 10px' }}>
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
