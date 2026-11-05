'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import TabBar from '@/components/TabBar';

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

  const isFiles = pathname && pathname !== '/admin' && !pathname.startsWith('/admin/') && !pathname.startsWith('/profile') && !pathname.startsWith('/login') && !pathname.startsWith('/share');

  return (
    <>
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

        {/* Phones have the bottom bar for everything else */}
        <button className="btn btn-ghost btn-sm nav-signout-mobile" onClick={handleLogout}>Sign Out</button>
      </div>
    </nav>

    <TabBar tabs={[
      { label: 'Files', icon: 'folder', href: '/', active: !!isFiles },
      ...(user.role === 'admin' ? [{ label: 'Admin', icon: 'shield', href: '/admin', active: !!pathname?.startsWith('/admin') }] : []),
      { label: 'Profile', icon: 'user', href: '/profile', active: !!pathname?.startsWith('/profile') },
    ]} />
    </>
  );
}
