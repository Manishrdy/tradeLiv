'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth';
import { api, DesignerProfile, DashboardStats, ProjectSummary } from '@/lib/api';

const STATS = [
  {
    label: 'Active Projects',
    value: '0',
    sub: 'No projects yet',
    href: '/projects',
    cta: 'New project',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    label: 'Clients',
    value: '0',
    sub: 'No clients yet',
    href: '/clients',
    cta: 'Add client',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: 'Shortlisted',
    value: '0',
    sub: 'Products curated',
    href: '/catalog',
    cta: 'Browse catalog',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    label: 'Orders',
    value: '0',
    sub: 'Total placed',
    href: '/orders',
    cta: 'View orders',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
];

const QUICK_ACTIONS = [
  {
    href: '/clients',
    label: 'Add a client',
    sub: 'Create your first client profile',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    ),
    step: '1',
  },
  {
    href: '/projects',
    label: 'Create a project',
    sub: 'Start a new design project',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
    step: '2',
  },
  {
    href: '/catalog',
    label: 'Import products',
    sub: 'Add furniture from any URL',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
    step: '3',
  },
];

const STATUS_DOT: Record<string, string> = {
  draft: '#B0ADA8', active: '#2d7a4f', ordered: '#2563eb', closed: '#555',
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [profile, setProfile]   = useState<DesignerProfile | null>(null);
  const [stats, setStats]       = useState<DashboardStats>({ activeProjects: 0, totalClients: 0, totalShortlisted: 0, totalOrders: 0 });
  const [recent, setRecent]     = useState<ProjectSummary[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    api.getMe().then((r) => { if (r.data) setProfile(r.data); });
    api.getDashboardStats().then((r) => { if (r.data) setStats(r.data); });
    api.getProjects().then((r) => {
      if (r.data) setRecent(r.data.slice(0, 5));
      setRecentLoading(false);
    });
  }, []);

  const firstName = (profile?.fullName ?? user?.fullName ?? '').split(' ')[0] || 'Designer';
  const businessName = profile?.businessName;

  return (
    <div style={{ padding: '40px 44px', maxWidth: 1100 }}>

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.035em', marginBottom: 6 }}>
          Good morning, {firstName}.
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {businessName ? `${businessName} · ` : ''}Here&apos;s what&apos;s happening in your studio.
        </p>
      </div>

      {/* ── Stat cards ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 44 }}>
        {STATS.map((s, i) => {
          const liveValues = [stats.activeProjects, stats.totalClients, stats.totalShortlisted, stats.totalOrders];
          const liveValue = liveValues[i];
          const liveSub = liveValue === 0 ? s.sub : `${liveValue} total`;
          // Orders module not yet available — render as non-interactive
          const disabled = s.label === 'Orders';
          return { ...s, value: String(liveValue ?? 0), sub: liveSub, disabled };
        }).map((s) => {
          const cardContent = (
            <div
              className="card"
              style={{
                padding: '20px 22px',
                cursor: s.disabled ? 'default' : 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
                opacity: s.disabled ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (s.disabled) return;
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={(e) => {
                if (s.disabled) return;
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '';
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 9, marginBottom: 16,
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)',
              }}>
                {s.icon}
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em', marginBottom: 3 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{s.sub}</div>
            </div>
          );
          return s.disabled
            ? <div key={s.label}>{cardContent}</div>
            : <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>{cardContent}</Link>;
        })}
      </div>

      {/* ── Get started ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

        {/* Quick actions */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
              Get started
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Set up your studio
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 14px', borderRadius: 9,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-input)',
                    transition: 'all 0.12s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)';
                    (e.currentTarget as HTMLDivElement).style.background = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-input)';
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-secondary)',
                  }}>
                    {a.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 1 }}>{a.label}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{a.sub}</div>
                  </div>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)',
                  }}>
                    {a.step}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent projects */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                Projects
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                Recent projects
              </h2>
            </div>
            <Link href="/projects" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}>
              View all →
            </Link>
          </div>

          {recentLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
              <svg className="anim-rotate" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
              Loading…
            </div>
          ) : recent.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 0', gap: 10 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6, maxWidth: 200, margin: 0 }}>
                No projects yet. Create your first project to get started.
              </p>
              <Link href="/projects/new" style={{ textDecoration: 'none' }}>
                <button className="btn-ghost" style={{ fontSize: 12 }}>+ New Project</button>
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recent.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} style={{ textDecoration: 'none' }}>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 9,
                      border: '1px solid var(--border)', background: 'var(--bg-input)',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = '#fff';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-input)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                    }}
                  >
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: STATUS_DOT[p.status] ?? '#B0ADA8',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>
                        {p.client.name} · {p._count.rooms} room{p._count.rooms !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, textTransform: 'capitalize', fontWeight: 600 }}>
                      {p.status}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
