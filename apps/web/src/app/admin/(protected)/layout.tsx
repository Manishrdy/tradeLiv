'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { api, AdminNotification } from '@/lib/api';

interface AdminUserState {
  id: string;
  fullName: string;
  email: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

const NAV = [
  {
    href: '/admin/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: '/admin/designers',
    label: 'Designers',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: '/admin/orders',
    label: 'Orders',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 01-8 0" />
      </svg>
    ),
  },
  {
    href: '/admin/payments',
    label: 'Payments',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    href: '/admin/brand-pos',
    label: 'Brand POs',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    href: '/admin/furniture-categories',
    label: 'Furniture',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3" />
        <path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0z" />
        <path d="M4 18v2" /><path d="M20 18v2" />
      </svg>
    ),
  },
  {
    href: '/admin/issues',
    label: 'Issues',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <circle cx="12" cy="16" r="1" />
      </svg>
    ),
  },
  {
    href: '/admin/team',
    label: 'Team',
    superAdminOnly: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    href: '/admin/analytics',
    label: 'Analytics',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    href: '/admin/time-tracking',
    label: 'Time Track',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    href: '/admin/health',
    label: 'Health',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    href: '/admin/config',
    label: 'Config',
    superAdminOnly: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

export default function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin]       = useState<AdminUserState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Notification state
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHydrated(true);
    api.getAdminMe().then((r) => {
      if (r.data && r.data.isAdmin) {
        setAdmin(r.data);
      } else {
        router.replace('/admin/login');
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // SSE for admin notifications
  useEffect(() => {
    if (!admin) return;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
    const es = new EventSource(`${baseUrl}/api/admin/notifications/stream`, { withCredentials: true });

    es.addEventListener('admin_unread_count', (e) => {
      try { setUnreadCount(JSON.parse(e.data).count); } catch (err) {
        console.warn('Failed to parse admin_unread_count SSE event', err);
      }
    });

    es.addEventListener('admin_notification', (e) => {
      try {
        const n = JSON.parse(e.data) as AdminNotification;
        setNotifications((prev) => [n, ...prev].slice(0, 50));
      } catch (err) {
        console.warn('Failed to parse admin_notification SSE event', err);
      }
    });

    return () => es.close();
  }, [admin]);

  // Close bell dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const loadNotifications = useCallback(() => {
    api.getAdminNotifications().then((r) => {
      if (r.data) setNotifications(r.data);
    });
  }, []);

  function handleBellClick() {
    if (!bellOpen) loadNotifications();
    setBellOpen((v) => !v);
  }

  async function handleMarkAllRead() {
    await api.markAllAdminNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function handleSignOut() {
    await api.logout();
    router.replace('/admin/login');
  }

  if (!hydrated || !admin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAF8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#B0ADA8', fontSize: 13.5 }}>
          <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading…
        </div>
      </div>
    );
  }

  const initials = admin.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>

      {/* ── Sidebar (#86 — distinct admin theme) ──────── */}
      <aside style={{
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#1A1A2E',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 40,
      }}>

        {/* Logo + badge */}
        <div style={{ padding: '22px 20px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.04em', color: '#fff' }}>
            tradeLiv
          </span>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.07em',
            color: '#C4A265', background: 'rgba(196,162,101,0.15)',
            padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase',
          }}>
            Admin
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 12px 8px' }} />

        {/* Nav */}
        <nav style={{ flex: 1, padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.filter((item) => !('superAdminOnly' in item && item.superAdminOnly) || admin?.isSuperAdmin).map(({ href, label, icon }) => {
            const active = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '8px 10px', borderRadius: 8,
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  borderLeft: active ? '2px solid #C4A265' : '2px solid transparent',
                  textDecoration: 'none', transition: 'all 0.12s ease',
                  letterSpacing: '-0.01em',
                  paddingLeft: active ? 8 : 10,
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.75)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.45)';
                  }
                }}
              >
                <span style={{ flexShrink: 0, opacity: active ? 1 : 0.5 }}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Notification bell */}
        <div ref={bellRef} style={{ padding: '4px 10px', position: 'relative' }}>
          <button
            onClick={handleBellClick}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, width: '100%',
              padding: '8px 10px', borderRadius: 8, border: 'none',
              background: bellOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: bellOpen ? '#fff' : 'rgba(255,255,255,0.45)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              letterSpacing: '-0.01em', textAlign: 'left',
              transition: 'all 0.12s ease', position: 'relative',
            }}
            onMouseEnter={(e) => { if (!bellOpen) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}}
            onMouseLeave={(e) => { if (!bellOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}}
          >
            <span style={{ flexShrink: 0, opacity: bellOpen ? 1 : 0.5, position: 'relative' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -6,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#ef4444', color: '#fff',
                  fontSize: 9, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
            Notifications
            {unreadCount > 0 && (
              <span style={{
                marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                color: '#fff', background: '#ef4444',
                padding: '1px 6px', borderRadius: 10,
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {bellOpen && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 10, marginBottom: 6,
              width: 340, maxHeight: 420, overflowY: 'auto',
              background: '#fff', border: '1px solid #E4E1DC', borderRadius: 12,
              boxShadow: '0 12px 40px rgba(0,0,0,0.15)', zIndex: 100,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: '1px solid #E8E5E0',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F0F0F' }}>Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{
                      background: 'none', border: 'none', fontSize: 11, fontWeight: 600,
                      color: '#6B6B6B', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#B0ADA8', fontSize: 13 }}>
                  No notifications
                </div>
              ) : (
                notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={n.designerId ? `/admin/designers/${n.designerId}` : '/admin/designers'}
                    onClick={() => {
                      setBellOpen(false);
                      if (!n.read) {
                        api.markAdminNotificationRead(n.id);
                        setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
                        setUnreadCount((c) => Math.max(0, c - 1));
                      }
                    }}
                    style={{
                      display: 'block', padding: '12px 16px',
                      borderBottom: '1px solid #F3F2EF', textDecoration: 'none',
                      background: n.read ? 'transparent' : 'rgba(196,162,101,0.06)',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = n.read ? '#FAFAF8' : 'rgba(196,162,101,0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(196,162,101,0.06)')}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      {!n.read && (
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%', background: '#C4A265',
                          marginTop: 5, flexShrink: 0,
                        }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0F0F0F', marginBottom: 2 }}>
                          {n.title}
                        </div>
                        {n.body && (
                          <div style={{ fontSize: 11.5, color: '#8C8984', lineHeight: 1.4 }}>
                            {n.body}
                          </div>
                        )}
                        <div style={{ fontSize: 10.5, color: '#B0ADA8', marginTop: 4 }}>
                          {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        {/* User + sign out */}
        <div style={{ padding: '8px 10px 14px' }}>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 10 }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 10px', borderRadius: 8,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(196,162,101,0.15)', border: '1px solid rgba(196,162,101,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#C4A265',
              letterSpacing: '0.02em',
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>
                {admin.fullName.split(' ')[0]}
              </div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                {admin.email}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.25)', padding: 4, borderRadius: 5,
                display: 'flex', alignItems: 'center', flexShrink: 0,
                transition: 'color 0.12s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────── */}
      <main style={{ marginLeft: 220, flex: 1, minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
