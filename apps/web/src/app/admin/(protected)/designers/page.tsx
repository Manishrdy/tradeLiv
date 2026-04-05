'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, AdminDesigner } from '@/lib/api';

const STATUS_OPTIONS = ['', 'email_pending', 'pending_review', 'approved', 'rejected', 'suspended'];

function queueAge(iso: string): string {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  email_pending:  { color: '#92400e', bg: '#fef3c7', label: 'Unverified' },
  approved:       { color: '#2d7a4f', bg: '#e8f5ee', label: 'Approved' },
  pending_review: { color: '#7a5c2d', bg: '#fdf5e6', label: 'Pending' },
  rejected:       { color: '#8b2635', bg: '#fdecea', label: 'Rejected' },
  suspended:      { color: '#555',    bg: '#f0f0f0', label: 'Suspended' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { color: '#555', bg: '#f0f0f0', label: status };
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
      color: s.color, background: s.bg,
      padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase',
    }}>
      {s.label}
    </span>
  );
}

export default function AdminDesignersPage() {
  const [designers, setDesigners] = useState<AdminDesigner[]>([]);
  const [loading, setLoading]     = useState(true);
  const [status, setStatus]       = useState('');
  const [search, setSearch]       = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]         = useState(0);

  const load = useCallback((s: string, q: string, p: number) => {
    setLoading(true);
    api.getAdminDesigners({ status: s || undefined, search: q || undefined, page: p }).then((r) => {
      if (r.data) {
        setDesigners(r.data.designers);
        setTotal(r.data.total);
        setTotalPages(r.data.totalPages);
        setPage(r.data.page);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(status, search, page); }, [status, search, page, load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <div style={{ padding: '40px 40px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
          Designers
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
          Manage designer accounts and applications.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Search */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6 }}>
          <input
            className="input-field"
            type="text"
            placeholder="Search by name or email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: 240, fontSize: 13 }}
          />
          <button type="submit" className="btn-ghost" style={{ fontSize: 13, padding: '8px 14px' }}>
            Search
          </button>
          {search && (
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: 13, padding: '8px 10px' }}
              onClick={() => { setPage(1); setSearch(''); setSearchInput(''); }}
            >
              ×
            </button>
          )}
        </form>

        {/* Status filter */}
        <select
          value={status}
          onChange={(e) => { setPage(1); setStatus(e.target.value); }}
          className="input-field"
          style={{ fontSize: 13, padding: '8px 12px', width: 'auto' }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === '' ? 'All statuses' : STATUS_STYLE[s]?.label ?? s}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13.5, padding: '40px 0' }}>
          <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading…
        </div>
      ) : designers.length === 0 ? (
        <div className="card" style={{ padding: '50px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>
          No designers found
        </div>
      ) : (
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Email', 'Business', 'Projects', 'Clients', 'Status', 'In Queue', 'Last Login', 'Joined', ''].map((h) => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left',
                    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {designers.map((d) => (
                <tr
                  key={d.id}
                  style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-input)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = '')}
                >
                  <td style={{ padding: '12px 16px', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {d.fullName}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {d.email}
                      {d.status === 'email_pending' ? (
                        <span title="Email not verified" style={{ fontSize: 9, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '1px 5px', borderRadius: 20, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                          UNVERIFIED
                        </span>
                      ) : (
                        <span title="Email verified" style={{ color: '#2d7a4f', fontSize: 12, lineHeight: 1 }}>✓</span>
                      )}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {d.businessName ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                    {d._count.projects}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                    {d._count.clients}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <StatusBadge status={d.status} />
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    {d.status === 'pending_review' && (() => {
                      const age = queueAge(d.createdAt);
                      const hours = Math.floor((Date.now() - new Date(d.createdAt).getTime()) / 3_600_000);
                      const stale = hours >= 48;
                      return (
                        <span style={{
                          fontSize: 11.5, fontWeight: 700, letterSpacing: '0.03em',
                          color: stale ? '#8b2635' : '#7a5c2d',
                          background: stale ? '#fdecea' : '#fdf5e6',
                          padding: '2px 8px', borderRadius: 20,
                        }}>
                          {age}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {d.lastLoginAt
                      ? new Date(d.lastLoginAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : <span style={{ color: 'var(--border-strong)', fontStyle: 'italic' }}>Never</span>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <Link
                      href={`/admin/designers/${d.id}`}
                      style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                        textDecoration: 'none', padding: '5px 12px',
                        border: '1px solid var(--border)', borderRadius: 7,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {total} result{total !== 1 ? 's' : ''}
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              className="btn-ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              style={{ fontSize: 12, padding: '5px 10px', opacity: page <= 1 ? 0.4 : 1 }}
            >
              Previous
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Page {page} of {totalPages}
            </span>
            <button
              className="btn-ghost"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={{ fontSize: 12, padding: '5px 10px', opacity: page >= totalPages ? 0.4 : 1 }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
