'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, AdminPayment } from '@/lib/api';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
  { value: 'expired', label: 'Expired' },
];

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount));
}

export default function AdminPaymentsPage() {
  const [payments, setPayments]   = useState<AdminPayment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [status, setStatus]       = useState('');
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]         = useState(0);

  const load = useCallback((s: string, p: number) => {
    setLoading(true);
    api.getAdminPayments({ status: s || undefined, page: p }).then((r) => {
      if (r.data) {
        setPayments(r.data.payments);
        setTotalPages(r.data.totalPages);
        setTotal(r.data.total);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(status, page); }, [status, page, load]);

  function isOverdue(payment: AdminPayment) {
    if (payment.status !== 'pending') return false;
    const daysSince = (Date.now() - new Date(payment.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 7;
  }

  return (
    <div style={{ padding: '40px 40px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
          Payments
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
          All payments across the platform.
        </p>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
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

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13.5, padding: '40px 0' }}>
          <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading...
        </div>
      ) : payments.length === 0 ? (
        <div className="card" style={{ padding: '50px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>
          No payments found
        </div>
      ) : (
        <>
          <div className="card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 750 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Order', 'Designer', 'Project', 'Amount', 'Currency', 'Status', 'Method', 'Stripe Ref', 'Date'].map((h) => (
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
                {payments.map((p) => {
                  const overdue = isOverdue(p);
                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid var(--border)', transition: 'background 0.1s',
                        background: p.status === 'failed' ? '#fef2f2' : overdue ? '#fffbeb' : undefined,
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.opacity = '0.85')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.opacity = '1')}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <Link href={`/admin/orders/${p.orderId}`} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace', textDecoration: 'none' }}>
                          {p.orderId.slice(0, 8)}
                        </Link>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {p.order.designer.fullName}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                        {p.order.project.name}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatCurrency(p.amount)}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {p.currency}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase',
                          color: p.status === 'paid' ? '#2d7a4f' : p.status === 'failed' ? '#8b2635' : p.status === 'expired' ? '#555' : '#7a5c2d',
                          background: p.status === 'paid' ? '#e8f5ee' : p.status === 'failed' ? '#fdecea' : p.status === 'expired' ? '#f0f0f0' : '#fdf5e6',
                        }}>
                          {p.status}{overdue ? ' (overdue)' : ''}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--text-muted)' }}>
                        {p.paymentMethod ?? '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {p.stripePaymentIntentId?.slice(0, 16) ?? '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{total} payment{total !== 1 ? 's' : ''}</span>
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
