'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, AdminBrandPO } from '@/lib/api';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'sent', label: 'Sent' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'in_production', label: 'In Production' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PO_STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  sent:          { color: '#7a5c2d', bg: '#fdf5e6', label: 'Sent' },
  acknowledged:  { color: '#2d5f7a', bg: '#e6f0fd', label: 'Acknowledged' },
  in_production: { color: '#6b2d7a', bg: '#f3e6fd', label: 'In Production' },
  dispatched:    { color: '#2d7a4f', bg: '#e8f5ee', label: 'Dispatched' },
  delivered:     { color: '#2d7a4f', bg: '#e8f5ee', label: 'Delivered' },
  cancelled:     { color: '#8b2635', bg: '#fdecea', label: 'Cancelled' },
};

const ALL_PO_STATUSES = ['sent', 'acknowledged', 'in_production', 'dispatched', 'delivered', 'cancelled'];

function StatusBadge({ status }: { status: string }) {
  const s = PO_STATUS_STYLE[status] ?? { color: '#555', bg: '#f0f0f0', label: status };
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

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount));
}

export default function AdminBrandPOsPage() {
  const [brandPOs, setBrandPOs] = useState<AdminBrandPO[]>([]);
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState('');
  const [brandSearch, setBrandSearch] = useState('');
  const [brandInput, setBrandInput]   = useState('');
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]       = useState(0);

  const load = useCallback((s: string, brand: string, p: number) => {
    setLoading(true);
    api.getAdminBrandPos({ status: s || undefined, brandName: brand || undefined, page: p }).then((r) => {
      if (r.data) {
        setBrandPOs(r.data.brandPOs);
        setTotalPages(r.data.totalPages);
        setTotal(r.data.total);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(status, brandSearch, page); }, [status, brandSearch, page, load]);

  function handleBrandSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setBrandSearch(brandInput.trim());
  }

  async function handleStatusChange(poId: string, newStatus: string) {
    const r = await api.updateAdminBrandPoStatus(poId, newStatus);
    if (!r.error) {
      setBrandPOs((prev) => prev.map((po) => po.id === poId ? { ...po, status: newStatus } : po));
    }
  }

  function isStale(po: AdminBrandPO) {
    if (po.status !== 'sent') return false;
    const daysSince = (Date.now() - new Date(po.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 14;
  }

  return (
    <div style={{ padding: '40px 40px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
          Brand Purchase Orders
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
          All brand POs across the platform.
        </p>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
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

      {/* Brand search */}
      <form onSubmit={handleBrandSearch} style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <input
          className="input-field"
          type="text"
          placeholder="Search by brand name..."
          value={brandInput}
          onChange={(e) => setBrandInput(e.target.value)}
          style={{ width: 280, fontSize: 13 }}
        />
        <button type="submit" className="btn-ghost" style={{ fontSize: 13, padding: '8px 14px' }}>Search</button>
        {brandSearch && (
          <button type="button" className="btn-ghost" style={{ fontSize: 13, padding: '8px 10px' }} onClick={() => { setBrandSearch(''); setBrandInput(''); setPage(1); }}>
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
      ) : brandPOs.length === 0 ? (
        <div className="card" style={{ padding: '50px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>
          No brand POs found
        </div>
      ) : (
        <>
          <div className="card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 750 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Brand', 'Order', 'Designer', 'Project', 'Status', 'Items', 'Subtotal', 'Created', ''].map((h) => (
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
                {brandPOs.map((po) => {
                  const stale = isStale(po);
                  return (
                    <tr
                      key={po.id}
                      style={{
                        borderBottom: '1px solid var(--border)', transition: 'background 0.1s',
                        background: stale ? '#fffbeb' : undefined,
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.opacity = '0.85')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.opacity = '1')}
                    >
                      <td style={{ padding: '12px 14px', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {po.brandName}
                        {stale && <span style={{ marginLeft: 6, fontSize: 10, color: '#b45309' }}>STALE</span>}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <Link href={`/admin/orders/${po.orderId}`} style={{ fontSize: 12.5, fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)', textDecoration: 'none' }}>
                          {po.orderId.slice(0, 8)}
                        </Link>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {po.order.designer.fullName}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                        {po.order.project.name}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={po.status} />
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                        {po._count.lineItems}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatCurrency(po.subtotal)}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(po.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <select
                          value={po.status}
                          onChange={(e) => handleStatusChange(po.id, e.target.value)}
                          className="input-field"
                          style={{ fontSize: 11, padding: '4px 6px', width: 'auto' }}
                        >
                          {ALL_PO_STATUSES.map((s) => (
                            <option key={s} value={s}>{PO_STATUS_STYLE[s]?.label ?? s}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{total} brand PO{total !== 1 ? 's' : ''}</span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ fontSize: 12, padding: '6px 12px' }}>Previous</button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '32px' }}>Page {page} of {totalPages}</span>
                <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ fontSize: 12, padding: '6px 12px' }}>Next</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
