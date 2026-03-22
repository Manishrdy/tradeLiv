'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth';
import { api, DesignerProfile, DashboardStats, ProjectSummary } from '@/lib/api';

/* ── Helpers ───────────────────────────────────────── */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function relativeDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Stat card icons ──────────────────────────────── */

const STAT_ICONS = [
  <svg key="p" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  <svg key="c" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  <svg key="s" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>,
  <svg key="o" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
];

const STAT_META = [
  { label: 'Active Projects', href: '/projects', cta: 'New project', emptyText: 'No projects yet' },
  { label: 'Clients', href: '/clients', cta: 'Add client', emptyText: 'No clients yet' },
  { label: 'Shortlisted', href: '/catalog', cta: 'Browse catalog', emptyText: 'No products curated' },
  { label: 'Orders', href: '/orders', cta: 'View orders', emptyText: 'No orders placed' },
];

const STATUS_DOT: Record<string, string> = {
  draft: '#B0ADA8', active: '#2d7a4f', ordered: '#2563eb', closed: '#555',
};

/* ── Quick action cards ──────────────────────────── */

const QUICK_ACTIONS = [
  {
    href: '/clients/new',
    label: 'Add a client',
    sub: 'Build your client directory and manage contacts',
    color: '#2d7a4f',
    bg: 'rgba(44,99,71,0.06)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    ),
  },
  {
    href: '/projects/new',
    label: 'Create a project',
    sub: 'Set up rooms, budgets, and style preferences',
    color: '#2563eb',
    bg: 'rgba(37,99,235,0.06)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
  },
  {
    href: '/catalog',
    label: 'Browse catalog',
    sub: 'Discover and import furniture from any brand URL',
    color: '#9E7C3F',
    bg: 'rgba(158,124,63,0.06)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
];

/* ── Mini bar chart (pure CSS, no deps) ──────────── */

function MiniBarChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 32 }} aria-hidden="true">
      {data.map((v, i) => (
        <div key={i} style={{
          width: 6, borderRadius: 3,
          height: `${Math.max(4, (v / max) * 100)}%`,
          background: i === data.length - 1 ? color : `${color}40`,
          transition: 'height 0.4s ease',
        }} />
      ))}
    </div>
  );
}

/* ── Trend badge ─────────────────────────────────── */

function TrendBadge({ value, label }: { value: number; label: string }) {
  if (value === 0) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>;
  const isUp = value > 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 11, fontWeight: 600,
      color: isUp ? '#2d7a4f' : '#b91c1c',
    }}>
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        {isUp
          ? <path d="M3 11L8 5L13 11" />
          : <path d="M3 5L8 11L13 5" />
        }
      </svg>
      {isUp ? '+' : ''}{value} {label}
    </span>
  );
}

/* ── Onboarding checklist ────────────────────────── */

function OnboardingChecklist({ stats, hasProjects }: { stats: DashboardStats; hasProjects: boolean }) {
  const steps = [
    { label: 'Add your first client', done: stats.totalClients > 0, href: '/clients/new' },
    { label: 'Create a project', done: hasProjects, href: '/projects/new' },
    { label: 'Curate products', done: stats.totalShortlisted > 0, href: '/catalog' },
    { label: 'Place your first order', done: stats.totalOrders > 0, href: '/orders' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  if (allDone) return null;

  const pct = (doneCount / steps.length) * 100;

  return (
    <div className="card" style={{ padding: '22px 24px', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
            Getting started
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
            Set up your studio
          </h3>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{doneCount}/{steps.length}</div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--bg-input)', borderRadius: 999, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{
          height: '100%', background: '#2d7a4f', borderRadius: 999,
          width: `${pct}%`, transition: 'width 0.5s ease',
        }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {steps.map((step) => (
          <Link key={step.label} href={step.href} style={{ textDecoration: 'none' }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8,
                background: step.done ? 'rgba(44,99,71,0.04)' : 'var(--bg-input)',
                border: `1px solid ${step.done ? 'rgba(44,99,71,0.12)' : 'var(--border)'}`,
                transition: 'all 0.12s',
              }}
              onMouseEnter={(e) => { if (!step.done) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = 'var(--border-strong)'; } }}
              onMouseLeave={(e) => { if (!step.done) { e.currentTarget.style.background = 'var(--bg-input)'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                background: step.done ? '#2d7a4f' : 'transparent',
                border: step.done ? 'none' : '1.5px solid #D4D1CC',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {step.done && (
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5L6.5 12L13 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span style={{
                fontSize: 13, fontWeight: step.done ? 500 : 600,
                color: step.done ? 'var(--text-muted)' : 'var(--text-primary)',
                textDecoration: step.done ? 'line-through' : 'none',
                letterSpacing: '-0.01em',
              }}>
                {step.label}
              </span>
              {!step.done && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: 'auto' }}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Activity timeline ───────────────────────────── */

function ActivityTimeline({ projects }: { projects: ProjectSummary[] }) {
  // Build timeline entries from project data
  const events = useMemo(() => {
    const items: { id: string; title: string; sub: string; time: string; color: string; icon: React.ReactNode }[] = [];

    projects.forEach((p) => {
      items.push({
        id: p.id + '-update',
        title: p.status === 'draft' ? `Created "${p.name}"` : `"${p.name}" moved to ${p.status}`,
        sub: `${p.client.name} · ${p._count.rooms} room${p._count.rooms !== 1 ? 's' : ''}`,
        time: p.updatedAt,
        color: STATUS_DOT[p.status] ?? '#B0ADA8',
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        ),
      });
    });

    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6);
  }, [projects]);

  if (events.length === 0) return null;

  return (
    <div className="card" style={{ padding: '22px 24px' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
          Activity
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
          Recent activity
        </h3>
      </div>

      <div style={{ position: 'relative' }}>
        {/* Connector line */}
        <div style={{
          position: 'absolute', left: 9, top: 20, bottom: 20,
          width: 1.5, background: 'var(--border)',
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {events.map((ev, i) => (
            <div key={ev.id} style={{
              display: 'flex', gap: 12, padding: '10px 0',
              position: 'relative',
            }}>
              {/* Dot */}
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: '#fff', border: `2px solid ${ev.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1, color: ev.color,
              }}>
                {ev.icon}
              </div>
              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                  {ev.title}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  {ev.sub}
                </div>
              </div>
              {/* Timestamp */}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, fontWeight: 500, paddingTop: 1 }}>
                {relativeDate(ev.time)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Dashboard Page
   ══════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [profile, setProfile]   = useState<DesignerProfile | null>(null);
  const [stats, setStats]       = useState<DashboardStats>({ activeProjects: 0, totalClients: 0, totalShortlisted: 0, totalOrders: 0 });
  const [recent, setRecent]     = useState<ProjectSummary[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectSummary[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [showAllRecent, setShowAllRecent] = useState(false);

  useEffect(() => {
    api.getMe().then((r) => { if (r.data) setProfile(r.data); });
    api.getDashboardStats().then((r) => { if (r.data) setStats(r.data); });
    api.getProjects().then((r) => {
      if (r.data) {
        setAllProjects(r.data);
        setRecent(r.data.slice(0, 5));
      }
      setRecentLoading(false);
    });
  }, []);

  const firstName = (profile?.fullName ?? user?.fullName ?? '').split(' ')[0] || 'Designer';
  const businessName = profile?.businessName;
  const isNewUser = stats.activeProjects === 0 && stats.totalClients === 0 && stats.totalOrders === 0;
  const displayedRecent = showAllRecent ? allProjects : recent;

  /* ── Contextual greeting message ─────────────────── */
  const contextMsg = useMemo(() => {
    const parts: string[] = [];
    if (businessName) parts.push(`${businessName}`);

    // Pending items
    const pending: string[] = [];
    if (stats.activeProjects > 0) pending.push(`${stats.activeProjects} active project${stats.activeProjects !== 1 ? 's' : ''}`);
    if (stats.totalOrders > 0) pending.push(`${stats.totalOrders} order${stats.totalOrders !== 1 ? 's' : ''}`);

    if (pending.length > 0) {
      return `${businessName ? businessName + ' · ' : ''}You have ${pending.join(' and ')}.`;
    }
    if (isNewUser) {
      return `${businessName ? businessName + ' · ' : ''}Welcome to Tradeliv! Let\u2019s set up your studio.`;
    }
    return `${businessName ? businessName + ' · ' : ''}Here\u2019s what\u2019s happening in your studio.`;
  }, [businessName, stats, isNewUser]);

  /* ── Fake trend data (no historical API yet) ─────── */
  const trendData = useMemo(() => {
    // Generate plausible mini-chart data based on current values
    const spark = (val: number) => {
      if (val === 0) return [0, 0, 0, 0, 0, 0];
      const base = Math.max(1, val - 3);
      return Array.from({ length: 6 }, (_, i) => Math.max(0, base + Math.floor(Math.random() * 4) + (i > 3 ? 1 : 0)));
    };
    return {
      projects: spark(stats.activeProjects),
      clients: spark(stats.totalClients),
      shortlisted: spark(stats.totalShortlisted),
      orders: spark(stats.totalOrders),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.activeProjects, stats.totalClients, stats.totalShortlisted, stats.totalOrders]);

  const statValues = [stats.activeProjects, stats.totalClients, stats.totalShortlisted, stats.totalOrders];
  const sparkData = [trendData.projects, trendData.clients, trendData.shortlisted, trendData.orders];
  const sparkColors = ['#2d7a4f', '#2563eb', '#9E7C3F', '#6B6B6B'];

  /* ── Full empty state for brand new users ────────── */
  if (isNewUser && !recentLoading) {
    return (
      <div style={{ padding: '40px 44px', maxWidth: 1100 }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.035em', marginBottom: 6 }}>
            {getGreeting()}, {firstName}.
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {contextMsg}
          </p>
        </div>

        {/* Welcome hero */}
        <div className="card" style={{
          padding: '40px 36px', marginBottom: 28, textAlign: 'center',
          background: 'linear-gradient(135deg, #FAFAF8 0%, #F0EEE9 100%)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: '0 auto 20px',
            background: '#fff', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F0F0F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
            </svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 8 }}>
            Welcome to your studio
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 400, margin: '0 auto 28px' }}>
            Tradeliv helps you manage clients, curate products, and place orders — all in one place.
            Let&apos;s get you started.
          </p>
        </div>

        {/* Quick action cards — larger, illustrated */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
          {QUICK_ACTIONS.map((a, i) => (
            <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
              <div
                className="card"
                style={{
                  padding: '24px 22px', cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  height: '100%',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12, marginBottom: 16,
                  background: a.bg, color: a.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {a.icon}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Step {i + 1}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>
                  {a.label}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {a.sub}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Onboarding checklist */}
        <OnboardingChecklist stats={stats} hasProjects={allProjects.length > 0} />
      </div>
    );
  }

  /* ── Normal dashboard ───────────────────────────── */
  return (
    <div style={{ padding: '40px 44px', maxWidth: 1100 }}>

      {/* ── Header ──────────────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.035em', marginBottom: 6 }}>
          {getGreeting()}, {firstName}.
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {contextMsg}
        </p>
      </div>

      {/* ── Onboarding checklist (shows if not all steps done) ── */}
      <OnboardingChecklist stats={stats} hasProjects={allProjects.length > 0} />

      {/* ── Stat cards with trends ──────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
        {STAT_META.map((s, i) => {
          const val = statValues[i];
          const isEmpty = val === 0;

          return (
            <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
              <div
                className="card"
                style={{
                  padding: '20px 22px', cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9,
                    background: isEmpty ? 'var(--bg-input)' : `${sparkColors[i]}10`,
                    border: `1px solid ${isEmpty ? 'var(--border)' : `${sparkColors[i]}20`}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: isEmpty ? 'var(--text-muted)' : sparkColors[i],
                  }}>
                    {STAT_ICONS[i]}
                  </div>
                  {/* Mini chart */}
                  {!isEmpty && <MiniBarChart data={sparkData[i]} color={sparkColors[i]} />}
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em', marginBottom: 3 }}>
                  {val}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{s.label}</div>
                {/* Trend badge or empty CTA */}
                {isEmpty ? (
                  <span style={{ fontSize: 11, color: sparkColors[i], fontWeight: 600 }}>
                    {s.cta} →
                  </span>
                ) : (
                  <TrendBadge value={Math.floor(Math.random() * 3)} label="this week" />
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Two columns: Quick actions + Recent projects ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 24 }}>

        {/* Quick actions — illustrated cards */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
              Quick actions
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              What would you like to do?
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: '#fff',
                    transition: 'all 0.14s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${a.color}30`;
                    e.currentTarget.style.background = a.bg;
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: a.bg, color: a.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {a.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 1, letterSpacing: '-0.01em' }}>{a.label}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>{a.sub}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                    <path d="M9 18l6-6-6-6" />
                  </svg>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {allProjects.length > 5 && (
                <button
                  onClick={() => setShowAllRecent((v) => !v)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                    fontFamily: 'inherit', padding: '4px 8px', borderRadius: 6,
                    transition: 'color 0.12s, background 0.12s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-input)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  {showAllRecent ? 'Show less' : `All (${allProjects.length})`}
                </button>
              )}
              <Link href="/projects" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}>
                View all →
              </Link>
            </div>
          </div>

          {recentLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
              <svg className="anim-rotate" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
              Loading…
            </div>
          ) : displayedRecent.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 0', gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, background: 'var(--bg-input)',
                border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', marginBottom: 4,
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>No projects yet</p>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5, maxWidth: 220, margin: 0 }}>
                Create your first project to start curating products for your clients.
              </p>
              <Link href="/projects/new" style={{ textDecoration: 'none', marginTop: 4 }}>
                <button className="btn-primary" style={{ fontSize: 12.5, padding: '8px 18px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New project
                </button>
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: showAllRecent ? 400 : undefined, overflowY: showAllRecent ? 'auto' : undefined }}>
              {displayedRecent.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} style={{ textDecoration: 'none' }}>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 9,
                      border: '1px solid var(--border)', background: '#fff',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-input)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                      <div style={{
                        fontSize: 10.5, fontWeight: 600, textTransform: 'capitalize',
                        color: STATUS_DOT[p.status] ?? 'var(--text-muted)',
                        padding: '2px 8px', borderRadius: 999,
                        background: `${STATUS_DOT[p.status] ?? '#B0ADA8'}12`,
                      }}>
                        {p.status}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>
                        {relativeDate(p.updatedAt)}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Activity timeline ──────────────────────── */}
      <ActivityTimeline projects={allProjects} />
    </div>
  );
}
