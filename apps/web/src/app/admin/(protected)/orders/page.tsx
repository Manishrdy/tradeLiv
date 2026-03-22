'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, AdminOrderSummary } from '@/lib/api';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'paid', label: 'Paid' },
  { value: 'split_to_brands', label: 'Processing' },
  { value: 'closed', label: 'Closed' },
];

const ORDER_STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  draft:           { color: '#555',    bg: '#f0f0f0', label: 'Draft' },
  submitted:       { color: '#7a5c2d', bg: '#fdf5e6', label: 'Submitted' },
  paid:            { color: '#2d7a4f', bg: '#e8f5ee', label: 'Paid' },
  split_to_brands: { color: '#2d5f7a', bg: '#e6f0fd', label: 'Processing' },
  closed:          { color: '#555',    bg: '#f0f0f0', label: 'Closed' },
};

function StatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS_STYLE[status] ?? { color: '#555', bg: '#f0f0f0', label: status };
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
      color: s.color, background: s.bg,
      padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders]   = useState<AdminOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState('');
  const [search, setSearch]   = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]     = useState(0);

  const load = useCallback((s: string, q: string, p: number) => {
    setLoading(true);
    api.getAdminOrders({ status: s || undefined, search: q || undefined, page: p }).then((r) => {
      if (r.data) {
        setOrders(r.data.orders);
        setTotalPages(r.data.totalPages);
        setTotal(r.data.total);
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

  function formatCurrency(amount: number | null) {
    if (amount === null || amount === undefined) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount));
  }

  return (
    <div style={{ padding: '40px 40px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
          Orders
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
          All orders across the platform.
        </p>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => { setStatus(t.value); setPage(1); }}
            style={{
              fontSize: 12.5, fontWeight: 600, padding: '8px 14px', cursor: 'pointer',
              background: 'none', border: 'none',
              color: status === t.value ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: status === t.value ? '2px solid var(--text-primary)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <input
          className="input-field"
          type="text"
          placeholder="Search by project, client, designer, or order ID..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{ width: 360, fontSize: 13 }}
        />
        <button type="submit" className="btn-ghost" style={{ fontSize: 13, padding: '8px 14px' }}>Search</button>
        {search && (
          <button type="button" className="btn-ghost" style={{ fontSize: 13, padding: '8px 10px' }} onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}>
            ×
          </button>
        )}
      </form>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13.5, padding: '40px 0' }}>
          <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading...
        </div>
      ) : orders.length === 0 ? (
        <div className="card" style={{ padding: '50px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>
          No orders found
        </div>
      ) : (
        <>
          <div className="card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Order ID', 'Designer', 'Project', 'Client', 'Status', 'Items', 'Total', 'Date', ''].map((h) => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left',
                      fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s', cursor: 'pointer' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-input)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = '')}
                  >
                    <td style={{ padding: '12px 14px', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {o.id.slice(0, 8)}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {o.designer.fullName}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.project.name}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                      {o.project.client?.name ?? '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <StatusBadge status={o.status} />
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                      {o._count.lineItems}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {formatCurrency(o.totalAmount)}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        style={{
                          fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                          textDecoration: 'none', padding: '5px 12px',
                          border: '1px solid var(--border)', borderRadius: 7,
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

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{total} order{total !== 1 ? 's' : ''}</span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ fontSize: 12, padding: '6px 12px' }}>
                  Previous
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '32px' }}>
                  Page {page} of {totalPages}
                </span>
                <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ fontSize: 12, padding: '6px 12px' }}>
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
