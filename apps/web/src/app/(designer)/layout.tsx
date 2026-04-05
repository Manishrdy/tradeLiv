'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth';
import { api } from '@/lib/api';
import NotificationPanel from '@/components/NotificationPanel';
import OnboardingWizard from '@/components/OnboardingWizard';

/* ── Nav items ─────────────────────────────────────── */

const NAV = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    shortcut: 'D',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: '/clients',
    label: 'Clients',
    shortcut: 'C',
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
    href: '/projects',
    label: 'Projects',
    shortcut: 'P',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: '/catalog',
    label: 'Catalog',
    shortcut: 'A',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    href: '/orders',
    label: 'Orders',
    shortcut: 'O',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    shortcut: 'S',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

/* ── Breadcrumb mapping ────────────────────────────── */

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  clients: 'Clients',
  projects: 'Projects',
  catalog: 'Catalog',
  orders: 'Orders',
  settings: 'Settings',
  new: 'New',
  rooms: 'Rooms',
  cart: 'Cart',
};

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= 1) return [];

  const crumbs: { label: string; href: string }[] = [];
  let path = '';
  for (let i = 0; i < segments.length; i++) {
    path += '/' + segments[i];
    const seg = segments[i];
    const label = BREADCRUMB_LABELS[seg] ?? (seg.length > 20 ? seg.slice(0, 8) + '…' : seg);
    crumbs.push({ label, href: path });
  }
  return crumbs;
}

/* ── Logout confirmation modal ─────────────────────── */

function LogoutModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm sign out"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)',
      }}
      onClick={onCancel}
    >
      <div
        className="anim-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, padding: '28px 28px 22px',
          width: 340, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: 'rgba(185,28,28,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F0F0F', letterSpacing: '-0.02em', margin: 0 }}>Sign out?</h3>
            <p style={{ fontSize: 13, color: '#8C8984', margin: '4px 0 0', letterSpacing: '-0.01em' }}>You&apos;ll need to sign in again to access your studio.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button
            ref={cancelRef}
            onClick={onCancel}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8,
              border: '1.5px solid #E4E1DC', background: '#fff',
              fontSize: 13.5, fontWeight: 600, color: '#6B6B6B',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'border-color 0.14s, color 0.14s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0F0F0F'; e.currentTarget.style.color = '#0F0F0F'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E4E1DC'; e.currentTarget.style.color = '#6B6B6B'; }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8,
              border: 'none', background: '#b91c1c',
              fontSize: 13.5, fontWeight: 600, color: '#fff',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.14s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#991b1b')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#b91c1c')}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Keyboard shortcut hint badge ──────────────────── */

function KbdBadge({ shortcut }: { shortcut: string }) {
  return (
    <kbd style={{
      marginLeft: 'auto', fontSize: 9.5, fontWeight: 600,
      color: '#C8C5BF', background: '#F5F4F1',
      border: '1px solid #E8E5E0', borderRadius: 4,
      padding: '1px 5px', fontFamily: 'inherit',
      letterSpacing: '0.02em', lineHeight: '16px',
    }}>
      G {shortcut}
    </kbd>
  );
}

/* ══════════════════════════════════════════════════════
   Main Layout
   ══════════════════════════════════════════════════════ */

const SIDEBAR_FULL = 220;
const SIDEBAR_COLLAPSED = 60;

export default function DesignerLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, setUser, clearAuth } = useAuthStore();
  const [hydrated, setHydrated]       = useState(false);
  const [collapsed, setCollapsed]     = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [showLogout, setShowLogout]   = useState(false);
  const [gPressed, setGPressed]       = useState(false);
  const gTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [avatarUrl, setAvatarUrl]     = useState<string | null>(null);
  const [cmdkOpen, setCmdkOpen]       = useState(false);
  const [cmdkSearch, setCmdkSearch]   = useState('');
  const [isOffline, setIsOffline]     = useState(false);
  const [notifOpen, setNotifOpen]     = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    setHydrated(true);
    api.getMe().then((r) => {
      if (r.data) {
        setUser({ id: r.data.id, fullName: r.data.fullName, email: r.data.email, status: r.data.status, onboardingComplete: r.data.onboardingComplete });
        if (r.data.onboardingComplete === false) setShowOnboarding(true);
      } else {
        clearAuth();
        router.replace('/login');
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); setCmdkOpen(false); }, [pathname]);

  // Session tracking — heartbeat every 60s
  useEffect(() => {
    let sessionId: string | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    api.startSession().then((r) => {
      if (r.data) {
        sessionId = r.data.sessionId;
        heartbeatInterval = setInterval(() => {
          if (sessionId) api.heartbeatSession(sessionId);
        }, 60000);
      }
    });

    const endSession = () => {
      if (sessionId) api.endSession(sessionId);
    };
    window.addEventListener('beforeunload', endSession);

    return () => {
      window.removeEventListener('beforeunload', endSession);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      endSession();
    };
  }, []);

  // Offline detection (#100)
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    setIsOffline(!navigator.onLine);
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
  }, []);

  /* ── Notification SSE stream ─────────────────────── */
  useEffect(() => {
    if (!user) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    // Fetch initial unread count
    api.getNotificationUnreadCount().then((r) => {
      if (r.data) setNotifUnread(r.data.count);
    });

    // SSE connection
    const es = new EventSource(`${apiBase}/api/notifications/stream`, { withCredentials: true });
    es.addEventListener('unread_count', (e) => {
      try { setNotifUnread(JSON.parse(e.data).count); } catch {}
    });
    es.addEventListener('notification', () => {
      // Trigger browser notification if tab is not focused
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        // Just bump count — the panel will refetch on open
      }
    });

    return () => es.close();
  }, [user]);

  /* ── Keyboard shortcuts: G then <key> ───────────── */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger inside inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable) return;

      // Toggle sidebar: Cmd/Ctrl + B
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setCollapsed((c) => !c);
        return;
      }

      // Command palette: Cmd/Ctrl + K (#89)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdkOpen((v) => !v);
        setCmdkSearch('');
        return;
      }

      const key = e.key.toUpperCase();

      if (key === 'G' && !gPressed) {
        setGPressed(true);
        clearTimeout(gTimeout.current);
        gTimeout.current = setTimeout(() => setGPressed(false), 800);
        return;
      }

      if (gPressed) {
        setGPressed(false);
        clearTimeout(gTimeout.current);
        const navItem = NAV.find((n) => n.shortcut === key);
        if (navItem) {
          e.preventDefault();
          router.push(navItem.href);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); clearTimeout(gTimeout.current); };
  }, [gPressed, router]);

  if (!hydrated || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13.5 }}>
          <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading…
        </div>
      </div>
    );
  }

  async function handleSignOut() {
    setShowLogout(false);
    await api.logout();
    clearAuth();
    router.replace('/login');
  }

  const firstName = user?.fullName?.split(' ')[0] ?? 'Designer';
  const initials  = user?.fullName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'D';

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_FULL;
  const breadcrumbs = buildBreadcrumbs(pathname);

  /* ── Avatar upload handler ────────────────────────── */
  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarUrl(url);
    // TODO: Upload to server via api.uploadAvatar(file)
  }

  /* ── Sidebar content (shared between desktop & mobile) ── */
  function renderSidebar(isMobile: boolean) {
    const w = isMobile ? SIDEBAR_FULL : sidebarWidth;
    const isCollapsed = !isMobile && collapsed;

    return (
      <aside
        role="navigation"
        aria-label="Main navigation"
        style={{
          width: w,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--sidebar-bg)',
          borderRight: isMobile ? 'none' : '1px solid var(--sidebar-border)',
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          zIndex: isMobile ? 52 : 40,
          transition: isMobile ? 'none' : 'width 0.2s cubic-bezier(0.22,1,0.36,1)',
          overflowX: 'hidden',
        }}
      >
        {/* Logo + collapse toggle */}
        <div style={{ padding: isCollapsed ? '22px 0 18px' : '22px 20px 18px', display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between' }}>
          <Link href="/dashboard" style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.04em', color: '#0F0F0F', whiteSpace: 'nowrap', overflow: 'hidden', textDecoration: 'none' }}>
            {isCollapsed ? 'T' : 'tradeLiv'}
          </Link>
          {!isMobile && (
            <button
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#C8C5BF', padding: 4, borderRadius: 5,
                display: 'flex', alignItems: 'center',
                transition: 'color 0.12s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#0F0F0F')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#C8C5BF')}
            >
              {isCollapsed ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--sidebar-border)', margin: isCollapsed ? '0 8px 8px' : '0 12px 8px' }} />

        {/* Nav */}
        <nav style={{ flex: 1, padding: isCollapsed ? '6px 6px' : '6px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(({ href, label, icon, shortcut }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                title={isCollapsed ? `${label} (G ${shortcut})` : undefined}
                aria-current={active ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: isCollapsed ? '9px 0' : '8px 10px',
                  justifyContent: isCollapsed ? 'center' : undefined,
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                  background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                  borderLeft: isCollapsed ? 'none' : (active ? '2.5px solid var(--sidebar-active-border)' : '2.5px solid transparent'),
                  textDecoration: 'none',
                  transition: 'all 0.12s ease',
                  letterSpacing: '-0.01em',
                  paddingLeft: isCollapsed ? undefined : (active ? 8 : 10),
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'var(--sidebar-hover-bg)';
                    e.currentTarget.style.color = '#4A4A4A';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--sidebar-text)';
                  }
                }}
              >
                <span style={{ flexShrink: 0, opacity: active ? 1 : 0.65, display: 'flex', alignItems: 'center' }}>{icon}</span>
                {!isCollapsed && (
                  <>
                    {label}
                    <KbdBadge shortcut={shortcut} />
                  </>
                )}
                {/* Active indicator dot for collapsed */}
                {isCollapsed && active && (
                  <div style={{
                    position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                    width: 4, height: 4, borderRadius: '50%', background: '#0F0F0F',
                  }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Notification bell */}
        <div style={{ padding: isCollapsed ? '0 6px' : '0 10px', position: 'relative' }}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            title="Notifications"
            aria-label={`Notifications${notifUnread > 0 ? ` (${notifUnread} unread)` : ''}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              width: '100%', padding: isCollapsed ? '9px 0' : '8px 10px',
              justifyContent: isCollapsed ? 'center' : undefined,
              borderRadius: 8, background: notifOpen ? 'var(--sidebar-hover-bg)' : 'transparent', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
              fontWeight: 500, color: notifOpen ? '#4A4A4A' : 'var(--sidebar-text)',
              transition: 'all 0.12s', letterSpacing: '-0.01em',
              position: 'relative',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sidebar-hover-bg)'; e.currentTarget.style.color = '#4A4A4A'; }}
            onMouseLeave={(e) => { if (!notifOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sidebar-text)'; } }}
          >
            <span style={{ flexShrink: 0, opacity: 0.65, display: 'flex', alignItems: 'center', position: 'relative' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {/* Badge */}
              {notifUnread > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -6,
                  minWidth: 15, height: 15, borderRadius: 8,
                  background: '#ef4444', border: '1.5px solid var(--sidebar-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: '#fff',
                  padding: '0 3px', lineHeight: 1,
                }}>
                  {notifUnread > 99 ? '99+' : notifUnread}
                </span>
              )}
            </span>
            {!isCollapsed && 'Notifications'}
          </button>
          <NotificationPanel
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
            unreadCount={notifUnread}
            onUnreadChange={setNotifUnread}
            sidebarWidth={w}
          />
        </div>

        {/* User + sign out */}
        <div style={{ padding: isCollapsed ? '8px 6px 14px' : '8px 10px 14px' }}>
          <div style={{ height: 1, background: 'var(--sidebar-border)', marginBottom: 10 }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: isCollapsed ? '8px 0' : '8px 10px',
            justifyContent: isCollapsed ? 'center' : undefined,
            borderRadius: 8,
          }}>
            {/* Avatar with upload */}
            <label
              title="Change profile photo"
              style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: avatarUrl ? `url(${avatarUrl}) center/cover` : '#F0EEE9',
                border: '1px solid #E4E1DC',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: '#4A4A4A',
                letterSpacing: '0.02em',
                cursor: 'pointer', position: 'relative', overflow: 'hidden',
              }}
            >
              {!avatarUrl && initials}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                aria-label="Upload profile photo"
              />
              {/* Hover overlay */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(0,0,0,0.4)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity 0.15s',
              }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            </label>

            {!isCollapsed && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0F0F0F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>
                    {firstName}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#B0ADA8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                    {user?.email}
                  </div>
                </div>
                <button
                  onClick={() => setShowLogout(true)}
                  title="Sign out"
                  aria-label="Sign out"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#C8C5BF', padding: 4, borderRadius: 5,
                    display: 'flex', alignItems: 'center', flexShrink: 0,
                    transition: 'color 0.12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#b91c1c')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#C8C5BF')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </>
            )}

            {isCollapsed && (
              <button
                onClick={() => setShowLogout(true)}
                title="Sign out"
                aria-label="Sign out"
                style={{
                  position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#C8C5BF', padding: 4, borderRadius: 5,
                  display: 'none', alignItems: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>

      {showOnboarding && user && (
        <OnboardingWizard
          firstName={user.fullName?.split(' ')[0] ?? 'there'}
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      {/* ── Mobile hamburger ──────────────────────────── */}
      <div className="mobile-topbar" style={{
        display: 'none',
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 52, zIndex: 50,
        background: 'var(--sidebar-bg)',
        borderBottom: '1px solid var(--sidebar-border)',
        alignItems: 'center', padding: '0 16px',
        justifyContent: 'space-between',
      }}>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0F0F0F', display: 'flex', padding: 4 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <Link href="/dashboard" style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.04em', color: '#0F0F0F', textDecoration: 'none' }}>tradeLiv</Link>
        <div style={{ width: 28 }} /> {/* spacer */}
      </div>

      {/* ── Mobile overlay ────────────────────────────── */}
      {mobileOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 51,
            background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)',
          }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile sidebar drawer ─────────────────────── */}
      <div className="mobile-sidebar" style={{
        display: 'none',
        position: 'fixed', top: 0, bottom: 0, left: 0,
        zIndex: 52,
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s cubic-bezier(0.22,1,0.36,1)',
      }}>
        {/* Close button */}
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
          style={{
            position: 'absolute', top: 14, right: -44,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)', border: 'none',
            color: '#fff', cursor: 'pointer',
            display: mobileOpen ? 'flex' : 'none',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {renderSidebar(true)}
      </div>

      {/* ── Desktop sidebar ───────────────────────────── */}
      <div className="desktop-sidebar">
        {renderSidebar(false)}
      </div>

      {/* ── Main content ──────────────────────────────── */}
      <main className="main-content" style={{ marginLeft: sidebarWidth, flex: 1, minWidth: 0, transition: 'margin-left 0.2s cubic-bezier(0.22,1,0.36,1)' }}>
        {/* Breadcrumbs */}
        {breadcrumbs.length > 1 && (
          <nav aria-label="Breadcrumb" style={{ padding: '16px 44px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <span key={crumb.href} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {i > 0 && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#C8C5BF" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  )}
                  {isLast ? (
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0F0F0F', letterSpacing: '-0.01em' }}>
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      style={{
                        fontSize: 12.5, fontWeight: 500, color: '#B0ADA8',
                        textDecoration: 'none', letterSpacing: '-0.01em',
                        transition: 'color 0.12s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#6B6B6B')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#B0ADA8')}
                    >
                      {crumb.label}
                    </Link>
                  )}
                </span>
              );
            })}
          </nav>
        )}
        {children}
      </main>

      {/* ── Logout confirmation modal ─────────────────── */}
      {showLogout && <LogoutModal onConfirm={handleSignOut} onCancel={() => setShowLogout(false)} />}

      {/* ── Keyboard shortcut toast ────────────────────── */}
      {gPressed && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, background: '#0F0F0F', color: '#fff',
          padding: '8px 16px', borderRadius: 8,
          fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ opacity: 0.6 }}>Go to:</span>
          {NAV.map((n) => (
            <span key={n.shortcut} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <kbd style={{
                background: 'rgba(255,255,255,0.15)', borderRadius: 3,
                padding: '1px 5px', fontSize: 10, fontFamily: 'inherit',
              }}>{n.shortcut}</kbd>
              <span style={{ fontSize: 11, opacity: 0.7 }}>{n.label}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── Offline banner (#100) ─────────────────────── */}
      {isOffline && (
        <div className="offline-banner">
          You&apos;re offline. Some features may not work until you reconnect.
        </div>
      )}

      {/* ── Command palette (#89) ─────────────────────── */}
      {cmdkOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            paddingTop: '15vh',
          }}
          onClick={() => setCmdkOpen(false)}
        >
          <div
            className="anim-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, width: 520,
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
          >
            {/* Search input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={cmdkSearch}
                onChange={(e) => setCmdkSearch(e.target.value)}
                placeholder="Search or jump to…"
                autoFocus
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  fontSize: 15, fontFamily: 'inherit', color: 'var(--text-primary)',
                  background: 'transparent',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setCmdkOpen(false);
                }}
              />
              <kbd style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px' }}>ESC</kbd>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 320, overflowY: 'auto', padding: '8px 0' }}>
              {NAV.filter((n) =>
                !cmdkSearch.trim() ||
                n.label.toLowerCase().includes(cmdkSearch.toLowerCase())
              ).map((n) => (
                <button
                  key={n.href}
                  onClick={() => { router.push(n.href); setCmdkOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '10px 18px', border: 'none', background: 'transparent',
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 14,
                    fontWeight: 500, color: 'var(--text-primary)',
                    transition: 'background 0.08s', textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-input)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ opacity: 0.5, display: 'flex' }}>{n.icon}</span>
                  {n.label}
                  <kbd style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-muted)', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px' }}>
                    G {n.shortcut}
                  </kbd>
                </button>
              ))}
              {cmdkSearch.trim() && NAV.filter((n) => n.label.toLowerCase().includes(cmdkSearch.toLowerCase())).length === 0 && (
                <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No results for &ldquo;{cmdkSearch}&rdquo;
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Responsive CSS ────────────────────────────── */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-topbar { display: flex !important; }
          .mobile-sidebar { display: block !important; }
          .main-content { margin-left: 0 !important; padding-top: 52px; }
        }
        @media (min-width: 769px) {
          .mobile-topbar { display: none !important; }
          .mobile-sidebar { display: none !important; }
        }
      `}</style>
    </div>
  );
}
