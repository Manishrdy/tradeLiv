'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, AdminEnhancedStats, AdminDesigner } from '@/lib/api';

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  approved:       { color: '#2d7a4f', bg: '#e8f5ee', label: 'Approved' },
  pending_review: { color: '#7a5c2d', bg: '#fdf5e6', label: 'Pending' },
  rejected:       { color: '#8b2635', bg: '#fdecea', label: 'Rejected' },
  suspended:      { color: '#555',    bg: '#f0f0f0', label: 'Suspended' },
};

const ORDER_STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  draft:           { color: '#555',    bg: '#f0f0f0', label: 'Draft' },
  submitted:       { color: '#7a5c2d', bg: '#fdf5e6', label: 'Submitted' },
  paid:            { color: '#2d7a4f', bg: '#e8f5ee', label: 'Paid' },
  split_to_brands: { color: '#2d5f7a', bg: '#e6f0fd', label: 'Processing' },
  closed:          { color: '#555',    bg: '#f0f0f0', label: 'Closed' },
};

function StatusBadge({ status, styles }: { status: string; styles: Record<string, { color: string; bg: string; label: string }> }) {
  const s = styles[status] ?? { color: '#555', bg: '#f0f0f0', label: status };
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
      color: s.color, background: s.bg,
      padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

/* ── Mini revenue chart (pure CSS) (#84) ───────────── */

function RevenueChart({ trends }: { trends: { month: string; revenue: number }[] }) {
  const max = Math.max(...trends.map((t) => t.revenue), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
      {trends.map((t, i) => (
        <div key={t.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
          <div style={{
            width: '100%', borderRadius: 4,
            height: `${Math.max(8, (t.revenue / max) * 100)}%`,
            background: i === trends.length - 1 ? '#2d7a4f' : 'rgba(45,122,79,0.2)',
            transition: 'height 0.4s',
          }} />
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 500 }}>{t.month}</span>
        </div>
      ))}
    </div>
  );
}

/* ── CSV export helper (#88) ───────────────────────── */

function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboardPage() {
  const [stats, setStats]     = useState<AdminEnhancedStats | null>(null);
  const [pending, setPending] = useState<AdminDesigner[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState<'7d' | '30d' | '90d' | 'ytd'>('30d');
  const [rejectModal, setRejectModal] = useState<{ designerId: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    // Pending designers don't change by period — only fetch once
    api.getAdminDesigners({ status: 'pending_review', limit: 25 }).then((pRes) => {
      if (pRes.data) setPending(pRes.data.designers);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    api.getAdminEnhancedStats({ period }).then((sRes) => {
      if (sRes.data) setStats(sRes.data);
      setLoading(false);
    });
  }, [period]);

  /* ── Inline approve/reject for pending designers (#83) */
  async function handleApprove(designerId: string) {
    await api.updateDesignerStatus(designerId, 'approved');
    setPending((prev) => prev.filter((d) => d.id !== designerId));
    api.getAdminEnhancedStats({ period }).then((r) => { if (r.data) setStats(r.data); });
  }

  async function handleRejectSubmit() {
    if (!rejectModal) return;
    await api.updateDesignerStatus(rejectModal.designerId, 'rejected', rejectReason || undefined);
    setPending((prev) => prev.filter((d) => d.id !== rejectModal.designerId));
    setRejectModal(null);
    setRejectReason('');
    api.getAdminEnhancedStats({ period }).then((r) => { if (r.data) setStats(r.data); });
  }

  /* ── Export orders (#88) */
  function handleExportOrders() {
    if (!stats) return;
    const headers = ['Order ID', 'Designer', 'Project', 'Client', 'Status', 'Total', 'Date'];
    const rows = stats.recentOrders.map((o) => [
      o.id.slice(0, 8), o.designer.fullName, o.project.name,
      o.project.client?.name ?? '—', o.status,
      o.totalAmount !== null ? String(o.totalAmount) : '—', o.createdAt,
    ]);
    exportCSV('tradeliv-orders.csv', headers, rows);
  }

  function handleExportDesigners() {
    const headers = ['Name', 'Email', 'Business', 'Status', 'Applied'];
    const rows = pending.map((d) => [d.fullName, d.email, d.businessName ?? '—', 'pending_review', d.createdAt]);
    exportCSV('tradeliv-designers.csv', headers, rows);
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 40px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13.5 }}>
        <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 40px 80px' }}>

      {/* Header with time period selector (#82) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            Dashboard
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
            Platform overview
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-input)', borderRadius: 8, padding: 3 }}>
          {([
            { label: '7D', value: '7d' as const },
            { label: '30D', value: '30d' as const },
            { label: '90D', value: '90d' as const },
            { label: 'YTD', value: 'ytd' as const },
          ]).map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                border: 'none', borderRadius: 6, padding: '5px 12px',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                background: period === p.value ? '#fff' : 'transparent',
                color: period === p.value ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: period === p.value ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.12s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <>
          {/* Primary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            <StatCard label="Total designers" value={stats.designers.total} sub={`${stats.designers.pending_review} pending`} />
            <StatCard label="Total projects" value={stats.totalProjects} />
            <StatCard label="Total orders" value={stats.orders.total} />
            <StatCard label="Revenue" value={formatCurrency(stats.revenue.total)} sub={`${formatCurrency(stats.revenue.thisMonth)} this month`} />
          </div>

          {/* Order status breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Draft / Submitted', value: stats.orders.draft, color: '#7a5c2d', bg: '#fdf5e6' },
              { label: 'Paid', value: stats.orders.paid, color: '#2d7a4f', bg: '#e8f5ee' },
              { label: 'Processing', value: stats.orders.processing, color: '#2d5f7a', bg: '#e6f0fd' },
              { label: 'Closed', value: stats.orders.closed, color: '#555', bg: '#f0f0f0' },
            ].map((item) => (
              <div key={item.label} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', color: item.color, background: item.bg, padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase' }}>
                  {item.label}
                </span>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {/* Revenue + Payments row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 36 }}>
            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                Revenue
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Avg order value</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                    {formatCurrency(stats.revenue.averageOrderValue)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>This month</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#2d7a4f', letterSpacing: '-0.03em' }}>
                    {formatCurrency(stats.revenue.thisMonth)}
                  </div>
                </div>
              </div>
              {/* Revenue bar chart (#84) */}
              <RevenueChart trends={stats.monthlyTrends} />
            </div>

            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                Payment Health
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { label: 'Paid', value: stats.payments.paid, color: '#2d7a4f' },
                  { label: 'Pending', value: stats.payments.pending, color: '#7a5c2d' },
                  { label: 'Failed', value: stats.payments.failed, color: '#8b2635' },
                ].map((p) => (
                  <div key={p.label}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: p.color, letterSpacing: '-0.04em' }}>{p.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Orders */}
          {stats.recentOrders.length > 0 && (
            <div style={{ marginBottom: 36 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                  Recent Orders
                </h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleExportOrders}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'none', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '4px 10px',
                      fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export CSV
                  </button>
                  <Link href="/admin/orders" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                    View all →
                  </Link>
                </div>
              </div>
              <div className="card" style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Order', 'Designer', 'Project', 'Client', 'Status', 'Total', 'Date'].map((h) => (
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
                    {stats.recentOrders.map((o) => (
                      <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <Link href={`/admin/orders/${o.id}`} style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)', textDecoration: 'none' }}>
                            {o.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{o.designer.fullName}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{o.project.name}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)' }}>{o.project.client?.name ?? '—'}</td>
                        <td style={{ padding: '10px 14px' }}><StatusBadge status={o.status} styles={ORDER_STATUS_STYLE} /></td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {o.totalAmount !== null ? formatCurrency(Number(o.totalAmount)) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Pending applications */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
            Pending Applications
            {pending.length > 0 && (
              <span style={{
                marginLeft: 8, fontSize: 11, fontWeight: 700,
                color: '#7a5c2d', background: '#fdf5e6',
                padding: '2px 8px', borderRadius: 20,
              }}>
                {pending.length}
              </span>
            )}
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {pending.length > 0 && (
              <button onClick={handleExportDesigners}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                Export
              </button>
            )}
            <Link href="/admin/designers" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              View all →
            </Link>
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="card" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>
            No pending applications
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Name', 'Email', 'Business', 'Applied', ''].map((h) => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left',
                      fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.map((d) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{d.fullName}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{d.email}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{d.businessName ?? '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-muted)' }}>
                      {new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleApprove(d.id)}
                          style={{
                            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                            border: '1px solid var(--green-border)', background: 'var(--green-dim)',
                            color: 'var(--green)', cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectModal({ designerId: d.id, name: d.fullName })}
                          style={{
                            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                            border: '1px solid rgba(185,28,28,0.15)', background: 'rgba(185,28,28,0.04)',
                            color: '#b91c1c', cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          Reject
                        </button>
                        <Link href={`/admin/designers/${d.id}`} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Designer status breakdown */}
      {stats && (
        <div style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 14 }}>
            Designer Status Breakdown
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {(['approved', 'pending_review', 'rejected', 'suspended'] as const).map((s) => (
              <div key={s} className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <StatusBadge status={s} styles={STATUS_STYLE} />
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
                  {stats.designers[s]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejection reason modal */}
      {rejectModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) { setRejectModal(null); setRejectReason(''); } }}
        >
          <div className="card" style={{ width: 420, padding: '28px 30px' }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '0 0 6px' }}>
              Reject Application
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 18px' }}>
              Rejecting <strong>{rejectModal.name}</strong>. Provide a reason so the designer knows why.
            </p>
            <label className="form-label">Rejection reason</label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="e.g. Portfolio does not meet our quality standards at this time."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{ fontSize: 13, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button className="btn-ghost" onClick={() => { setRejectModal(null); setRejectReason(''); }} style={{ fontSize: 13 }}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleRejectSubmit}
                disabled={!rejectReason.trim()}
                style={{
                  fontSize: 13, padding: '9px 18px',
                  background: '#b91c1c', opacity: !rejectReason.trim() ? 0.5 : 1,
                }}
              >
                Reject Application
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
