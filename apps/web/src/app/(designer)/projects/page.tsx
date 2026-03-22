'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ProjectSummary } from '@/lib/api';

/* ── Constants ─────────────────────────────────────── */

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Active', value: 'active' },
  { label: 'Ordered', value: 'ordered' },
  { label: 'Closed', value: 'closed' },
  { label: 'Archived', value: 'archived' },
];

const STATUS_STYLES: Record<string, { bg: string; border: string; color: string; dot: string }> = {
  draft:    { bg: 'rgba(0,0,0,0.04)',     border: 'rgba(0,0,0,0.09)',     color: '#8C8984',  dot: '#B0ADA8' },
  active:   { bg: 'var(--green-dim)',      border: 'var(--green-border)',   color: 'var(--green)', dot: '#2d7a4f' },
  ordered:  { bg: 'rgba(37,99,235,0.07)', border: 'rgba(37,99,235,0.18)', color: '#2563eb',  dot: '#2563eb' },
  closed:   { bg: 'rgba(0,0,0,0.06)',     border: 'rgba(0,0,0,0.10)',     color: '#555',     dot: '#555' },
  archived: { bg: 'rgba(0,0,0,0.03)',     border: 'rgba(0,0,0,0.06)',     color: '#B0ADA8',  dot: '#D4D1CC' },
};

type SortKey = 'updated' | 'created' | 'name' | 'budget' | 'client' | 'status';
const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'Last updated', value: 'updated' },
  { label: 'Date created', value: 'created' },
  { label: 'Name', value: 'name' },
  { label: 'Budget', value: 'budget' },
  { label: 'Client', value: 'client' },
  { label: 'Status', value: 'status' },
];

/* ── Helpers ───────────────────────────────────────── */

function formatBudget(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function sortProjects(list: ProjectSummary[], key: SortKey): ProjectSummary[] {
  const sorted = [...list];
  switch (key) {
    case 'updated':  return sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    case 'created':  return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case 'name':     return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'budget':   return sorted.sort((a, b) => (b.budgetMax ?? b.budgetMin ?? 0) - (a.budgetMax ?? a.budgetMin ?? 0));
    case 'client':   return sorted.sort((a, b) => a.client.name.localeCompare(b.client.name));
    case 'status':   return sorted.sort((a, b) => a.status.localeCompare(b.status));
    default:         return sorted;
  }
}

/* ══════════════════════════════════════════════════════
   Projects Page
   ══════════════════════════════════════════════════════ */

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects]     = useState<ProjectSummary[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeFilter, setActiveFilter] = useState('');
  const [search, setSearch]         = useState('');
  const [searching, setSearching]   = useState(false);
  const [sortBy, setSortBy]         = useState<SortKey>('updated');
  const [showSort, setShowSort]     = useState(false);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLoading(true);
    api.getProjects(activeFilter || undefined).then((r) => {
      if (r.data) setProjects(r.data);
      setLoading(false);
    });
    setSelected(new Set());
  }, [activeFilter]);

  // Close sort dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSort(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* ── Search with debounce indicator ──────────────── */
  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setSearching(true);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearching(false), 300);
  }, []);

  const filtered = search.trim()
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.client.name.toLowerCase().includes(search.toLowerCase())
      )
    : projects;

  const sorted = sortProjects(filtered, sortBy);

  /* ── Bulk selection ──────────────────────────────── */
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === sorted.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((p) => p.id)));
    }
  }

  async function bulkUpdateStatus(status: string) {
    if (selected.size === 0) return;
    setBulkLoading(true);
    await Promise.all(
      Array.from(selected).map((pid) => api.updateProject(pid, { status: status as 'draft' | 'active' | 'ordered' | 'closed' }))
    );
    setBulkLoading(false);
    setSelected(new Set());
    // Reload
    const r = await api.getProjects(activeFilter || undefined);
    if (r.data) setProjects(r.data);
  }

  return (
    <div style={{ padding: '40px 44px', maxWidth: 1100 }}>

      {/* ── Header ──────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.035em', margin: 0 }}>
            All Projects
          </h1>
          {!loading && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              {projects.length} project{projects.length !== 1 ? 's' : ''}
              {activeFilter ? ` · ${activeFilter}` : ''}
            </p>
          )}
        </div>
        <Link href="/projects/new" style={{ textDecoration: 'none' }}>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Project
          </button>
        </Link>
      </div>

      {/* ── Filters + Search + Sort ─────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Status filters */}
        <div style={{ display: 'flex', gap: 5 }}>
          {STATUS_FILTERS.map((f) => {
            const isActive = activeFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                style={{
                  border: `1px solid ${isActive ? 'var(--border-strong)' : 'var(--border)'}`,
                  background: isActive ? '#111111' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  borderRadius: 999, padding: '5px 14px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.12s',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {/* Debounce spinner */}
          {searching && search.trim() && (
            <svg className="anim-rotate" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          )}
          <input
            className="input-field"
            type="text"
            placeholder="Search projects or clients…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ paddingLeft: 34, width: '100%' }}
          />
        </div>

        {/* Sort dropdown */}
        <div ref={sortRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowSort((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'transparent',
              fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'border-color 0.12s',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M7 12h10M10 18h4" />
            </svg>
            Sort
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {showSort && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, zIndex: 10,
              marginTop: 4, background: '#fff', border: '1px solid var(--border)',
              borderRadius: 10, boxShadow: 'var(--shadow-md)',
              minWidth: 160, overflow: 'hidden',
            }}>
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setSortBy(opt.value); setShowSort(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '9px 14px',
                    background: sortBy === opt.value ? 'var(--bg-input)' : 'transparent',
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 12.5, fontWeight: sortBy === opt.value ? 700 : 500,
                    color: sortBy === opt.value ? 'var(--text-primary)' : 'var(--text-secondary)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-input)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = sortBy === opt.value ? 'var(--bg-input)' : 'transparent')}
                >
                  {opt.label}
                  {sortBy === opt.value && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bulk action bar ──────────────────────────── */}
      {selected.size > 0 && (
        <div className="anim-fade-up" style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px', marginBottom: 16,
          background: '#111111', borderRadius: 10, color: '#fff',
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>
            {selected.size} selected
          </span>
          <div style={{ height: 16, width: 1, background: 'rgba(255,255,255,0.15)' }} />
          {(['active', 'draft', 'closed', 'archived'] as const).map((st) => (
            <button
              key={st}
              onClick={() => bulkUpdateStatus(st)}
              disabled={bulkLoading}
              style={{
                background: 'rgba(255,255,255,0.1)', border: 'none',
                borderRadius: 6, padding: '4px 12px',
                fontSize: 11.5, fontWeight: 600, color: '#fff',
                cursor: 'pointer', fontFamily: 'inherit',
                textTransform: 'capitalize', transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            >
              {st === 'archived' ? 'Archive' : `Mark ${st}`}
            </button>
          ))}
          <button
            onClick={() => setSelected(new Set())}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4,
              display: 'flex', alignItems: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Select all (when items visible) ──────────── */}
      {!loading && sorted.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button
            onClick={selectAll}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 500, color: 'var(--text-muted)',
              fontFamily: 'inherit', padding: 0,
            }}
          >
            <div style={{
              width: 15, height: 15, borderRadius: 3,
              border: `1.5px solid ${selected.size === sorted.length && sorted.length > 0 ? '#111' : '#D4D1CC'}`,
              background: selected.size === sorted.length && sorted.length > 0 ? '#111' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.12s',
            }}>
              {selected.size === sorted.length && sorted.length > 0 && (
                <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5L6.5 12L13 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            {selected.size === sorted.length && sorted.length > 0 ? 'Deselect all' : 'Select all'}
          </button>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            · {sorted.length} project{sorted.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* ── List ──────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13.5 }}>
          <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading projects…
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '72px 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: '0 auto 18px',
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.6" strokeLinecap="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            {search ? 'No projects match your search' : activeFilter ? `No ${activeFilter} projects` : 'No projects yet'}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 24, maxWidth: 280, margin: '0 auto 24px' }}>
            {search ? 'Try a different search term or clear filters.' : 'Create your first project to start managing designs for your clients.'}
          </div>
          {!search && (
            <button className="btn-primary" onClick={() => router.push('/projects/new')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create first project
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 13 }}>
          {sorted.map((p) => {
            const st = STATUS_STYLES[p.status] ?? STATUS_STYLES.draft;
            const budget = formatBudget(p.budgetMin, p.budgetMax);
            const isSelected = selected.has(p.id);
            return (
              <div key={p.id} style={{ position: 'relative' }}>
                {/* Selection checkbox */}
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(p.id); }}
                  style={{
                    position: 'absolute', top: 14, left: 14, zIndex: 2,
                    width: 18, height: 18, borderRadius: 4,
                    border: `1.5px solid ${isSelected ? '#111' : '#D4D1CC'}`,
                    background: isSelected ? '#111' : 'rgba(255,255,255,0.9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.12s',
                    opacity: selected.size > 0 || isSelected ? 1 : 0,
                    padding: 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => { if (selected.size === 0 && !isSelected) e.currentTarget.style.opacity = '0'; }}
                >
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8.5L6.5 12L13 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                <Link href={`/projects/${p.id}`} style={{ textDecoration: 'none' }}>
                  <div
                    className="card"
                    style={{
                      padding: '20px 22px', cursor: 'pointer',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                      outline: isSelected ? '2px solid #111' : 'none',
                      outlineOffset: -1,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                      // Show checkbox on card hover
                      const cb = e.currentTarget.parentElement?.querySelector('button') as HTMLButtonElement;
                      if (cb) cb.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '';
                      const cb = e.currentTarget.parentElement?.querySelector('button') as HTMLButtonElement;
                      if (cb && selected.size === 0 && !isSelected) cb.style.opacity = '0';
                    }}
                  >
                    {/* Top row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                      <div style={{ flex: 1, minWidth: 0, paddingLeft: selected.size > 0 ? 24 : 0, transition: 'padding 0.15s' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: '50%',
                            background: 'var(--bg-input)', border: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 7.5, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0,
                          }}>
                            {initials(p.client.name)}
                          </div>
                          <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 500 }}>{p.client.name}</span>
                        </div>
                      </div>
                      {/* Status badge — filled pill */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: st.bg, border: `1px solid ${st.border}`,
                        borderRadius: 999, padding: '4px 11px',
                        fontSize: 11, color: st.color, fontWeight: 700, flexShrink: 0,
                        textTransform: 'capitalize',
                      }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot }} />
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
                          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{stat.value}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 1 }}>{stat.label}</div>
                        </div>
                      ))}
                      {budget && (
                        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{budget}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 1 }}>Budget</div>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                      Updated {formatDate(p.updatedAt)}
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
