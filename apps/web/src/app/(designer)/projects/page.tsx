'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ProjectSummary } from '@/lib/api';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Active', value: 'active' },
  { label: 'Ordered', value: 'ordered' },
  { label: 'Closed', value: 'closed' },
];

const STATUS_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  draft:   { bg: 'rgba(0,0,0,0.05)',    border: 'rgba(0,0,0,0.10)',    color: 'var(--text-muted)' },
  active:  { bg: 'rgba(39,103,73,0.1)', border: 'rgba(39,103,73,0.22)', color: '#276749' },
  ordered: { bg: 'rgba(44,82,130,0.1)', border: 'rgba(44,82,130,0.22)', color: '#2c5282' },
  closed:  { bg: 'rgba(0,0,0,0.05)',    border: 'rgba(0,0,0,0.10)',    color: 'var(--text-muted)' },
};

function formatBudget(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (v: number) => {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1).replace('.0', '')}Cr`;
    if (v >= 100000)   return `₹${(v / 100000).toFixed(1).replace('.0', '')}L`;
    return `₹${(v / 1000).toFixed(0)}K`;
  };
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api.getProjects(activeFilter || undefined).then((r) => {
      if (r.data) setProjects(r.data);
      setLoading(false);
    });
  }, [activeFilter]);

  const filtered = search.trim()
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.client.name.toLowerCase().includes(search.toLowerCase())
      )
    : projects;

  return (
    <div style={{ padding: '36px 40px', maxWidth: 1100 }}>

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4 }}>
            Projects
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            All Projects
          </h1>
        </div>
        <Link href="/projects/new" style={{ textDecoration: 'none' }}>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Project
          </button>
        </Link>
      </div>

      {/* ── Filters + Search ────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              style={{
                border: `1px solid ${activeFilter === f.value ? 'var(--gold-border)' : 'var(--border)'}`,
                background: activeFilter === f.value ? 'var(--gold-dim)' : 'transparent',
                color: activeFilter === f.value ? 'var(--gold)' : 'var(--text-muted)',
                borderRadius: 999, padding: '5px 14px', fontSize: 12.5, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="input-field"
            type="text"
            placeholder="Search projects or clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 36, width: '100%' }}
          />
        </div>
      </div>

      {/* ── List ────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 14 }}>
          <svg className="anim-rotate" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading projects…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '72px 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
            background: 'var(--bg-input)', border: '1.5px dashed var(--border-strong)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            {search ? 'No projects match your search' : 'No projects yet'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            {search ? 'Try a different search term.' : 'Create your first project to get started.'}
          </div>
          {!search && (
            <button className="btn-primary" onClick={() => router.push('/projects/new')}>
              Create first project
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {filtered.map((p) => {
            const st = STATUS_STYLES[p.status] ?? STATUS_STYLES.draft;
            const budget = formatBudget(p.budgetMin, p.budgetMax);
            return (
              <Link key={p.id} href={`/projects/${p.id}`} style={{ textDecoration: 'none' }}>
                <div
                  className="card"
                  style={{ padding: '20px 22px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-lg)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: 'linear-gradient(145deg, #e8d5a3, #c9a84c)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 8, fontWeight: 800, color: '#7a4f0a', flexShrink: 0,
                        }}>
                          {initials(p.client.name)}
                        </div>
                        <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 500 }}>{p.client.name}</span>
                      </div>
                    </div>
                    <div style={{
                      background: st.bg, border: `1px solid ${st.border}`,
                      borderRadius: 999, padding: '3px 10px',
                      fontSize: 11, color: st.color, fontWeight: 700, flexShrink: 0,
                      textTransform: 'capitalize',
                    }}>
                      {p.status}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                    {[
                      { label: 'Rooms', value: p._count.rooms },
                      { label: 'Shortlisted', value: p._count.shortlistItems },
                      { label: 'Orders', value: p._count.orders },
                    ].map((stat) => (
                      <div key={stat.label}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{stat.value}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{stat.label}</div>
                      </div>
                    ))}
                    {budget && (
                      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>{budget}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Budget</div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                    Updated {formatDate(p.updatedAt)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
