'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/user').then(r => {
      if (!r.ok) return null;
      return r.json();
    }).then(u => setUser(u));
  }, [pathname]);

  // Close mobile menu on navigation
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  if (!user) return null;

  const isFiles = pathname && pathname !== '/admin' && !pathname.startsWith('/admin/') && !pathname.startsWith('/profile') && !pathname.startsWith('/login') && !pathname.startsWith('/share');

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-logo">SkyBit</Link>

        {/* Desktop links */}
        <div className="nav-links nav-links-desktop">
          <Link href="/" className={`nav-link ${isFiles ? 'active' : ''}`}>Files</Link>
          {user.role === 'admin' && (
            <Link href="/admin" className={`nav-link ${pathname?.startsWith('/admin') ? 'active' : ''}`}>Admin</Link>
          )}
        </div>

        <div className="nav-spacer" />

        {/* Desktop user */}
        <div className="nav-user nav-user-desktop">
          <span className="nav-role-badge">{user.role}</span>
          <Link href="/profile" className="nav-link" style={{ padding: '6px 10px' }}>{user.username}</Link>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ fontSize: '0.78rem', padding: '5px 10px' }}>
            Sign Out
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="nav-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="nav-mobile-menu">
          <Link href="/" className={`nav-mobile-link ${isFiles ? 'active' : ''}`}>Files</Link>
          {user.role === 'admin' && (
            <Link href="/admin" className={`nav-mobile-link ${pathname?.startsWith('/admin') ? 'active' : ''}`}>Admin</Link>
          )}
          <Link href="/profile" className="nav-mobile-link">{user.username} ({user.role})</Link>
          <button className="nav-mobile-link nav-mobile-signout" onClick={handleLogout}>Sign Out</button>
        </div>
      )}
    </nav>
  );
}
