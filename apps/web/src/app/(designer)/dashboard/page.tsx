'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth';
import { api, DesignerProfile, DashboardStats } from '@/lib/api';

const STATS = [
  {
    label: 'Active Projects',
    value: '0',
    sub: 'No projects yet',
    href: '/projects',
    cta: 'New project',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
    color: '#2c5282',
    bg: 'rgba(44,82,130,0.08)',
    border: 'rgba(44,82,130,0.18)',
  },
  {
    label: 'Clients',
    value: '0',
    sub: 'No clients yet',
    href: '/clients',
    cta: 'Add client',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    color: '#276749',
    bg: 'rgba(39,103,73,0.08)',
    border: 'rgba(39,103,73,0.18)',
  },
  {
    label: 'Shortlisted',
    value: '0',
    sub: 'Products curated',
    href: '/catalog',
    cta: 'Browse catalog',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    color: '#a8710a',
    bg: 'rgba(168,113,10,0.08)',
    border: 'rgba(168,113,10,0.18)',
  },
  {
    label: 'Orders',
    value: '0',
    sub: 'Total placed',
    href: '/orders',
    cta: 'View orders',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.08)',
    border: 'rgba(124,58,237,0.18)',
  },
];

const QUICK_ACTIONS = [
  {
    href: '/clients',
    label: 'Add a client',
    sub: 'Create your first client profile',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
    step: '3',
  },
];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<DesignerProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats>({ activeProjects: 0, totalClients: 0, totalShortlisted: 0, totalOrders: 0 });

  useEffect(() => {
    api.getMe().then((r) => { if (r.data) setProfile(r.data); });
    api.getDashboardStats().then((r) => { if (r.data) setStats(r.data); });
  }, []);

  const firstName = (profile?.fullName ?? user?.fullName ?? '').split(' ')[0] || 'Designer';
  const businessName = profile?.businessName;

  return (
    <div style={{ padding: '36px 40px', maxWidth: 1100 }}>

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>
          Studio Overview
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 6 }}>
          Good morning, {firstName}.
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          {businessName ? `${businessName} · ` : ''}Here's what's happening in your studio.
        </p>
      </div>

      {/* ── Stat cards ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
        {STATS.map((s, i) => {
          const liveValues = [stats.activeProjects, stats.totalClients, stats.totalShortlisted, stats.totalOrders];
          const liveValue = liveValues[i];
          const liveSub = liveValue === 0 ? s.sub : `${liveValue} total`;
          return { ...s, value: String(liveValue ?? 0), sub: liveSub };
        }).map((s) => (
          <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
            <div
              className="card"
              style={{ padding: '20px 20px 18px', borderRadius: 16, cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-lg)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '';
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10, marginBottom: 14,
                background: s.bg, border: `1px solid ${s.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: s.color,
              }}>
                {s.icon}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 2 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{s.sub}</div>
            </div>
          </Link>
          ))}
      </div>

      {/* ── Get started ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Quick actions */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
              Get started
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Set up your studio
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {QUICK_ACTIONS.map((a, i, arr) => (
              <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '13px 14px', borderRadius: 12,
                    border: '1.5px solid var(--border)',
                    background: 'var(--bg-input)',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--gold-border)';
                    (e.currentTarget as HTMLDivElement).style.background = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-input)';
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: 'var(--gold-dim)', border: '1px solid var(--gold-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--gold)',
                  }}>
                    {a.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 1 }}>{a.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.sub}</div>
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: i < arr.length - 1 ? 'rgba(0,0,0,0.06)' : 'var(--gold-dim)',
                    border: `1px solid ${i < arr.length - 1 ? 'var(--border)' : 'var(--gold-border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, color: i < arr.length - 1 ? 'var(--text-muted)' : 'var(--gold)',
                  }}>
                    {a.step}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent activity placeholder */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
              Activity
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Recent activity
            </h2>
          </div>

          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '32px 0', gap: 10,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'var(--bg-input)', border: '1.5px dashed var(--border-strong)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5, maxWidth: 200 }}>
              Activity will appear here once you start working on projects.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
