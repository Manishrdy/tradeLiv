'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, OrderSummaryGlobal } from '@/lib/api';

const STATUS_FILTERS = [
  { label: 'All',        value: '' },
  { label: 'Unpaid',     value: 'draft' },
  { label: 'Paid',       value: 'paid' },
  { label: 'Processing', value: 'split_to_brands' },
  { label: 'Closed',     value: 'closed' },
];

const STATUS_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  draft:           { bg: 'rgba(0,0,0,0.04)',      border: 'rgba(0,0,0,0.09)',      color: 'var(--text-muted)',   label: 'Draft' },
  submitted:       { bg: 'rgba(50,80,190,0.07)',  border: 'rgba(50,80,190,0.18)',  color: '#3850be',             label: 'Submitted' },
  paid:            { bg: 'var(--green-dim)',       border: 'var(--green-border)',    color: 'var(--green)',        label: 'Paid' },
  split_to_brands: { bg: 'rgba(168,113,10,0.08)', border: 'rgba(168,113,10,0.2)',  color: 'var(--gold)',         label: 'Processing' },
  closed:          { bg: 'rgba(0,0,0,0.04)',      border: 'rgba(0,0,0,0.09)',      color: 'var(--text-muted)',   label: 'Closed' },
};

function formatPrice(price: number | null) {
  if (price == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderSummaryGlobal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api.getAllOrders(activeFilter || undefined).then((r) => {
      if (r.data) setOrders(r.data);
      setLoading(false);
    });
  }, [activeFilter]);

  const filtered = search.trim()
    ? orders.filter((o) =>
        o.id.toLowerCase().includes(search.toLowerCase()) ||
        o.project?.name?.toLowerCase().includes(search.toLowerCase()) ||
        o.project?.client?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : orders;

  return (
    <div style={{ padding: '32px 44px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>Orders</h1>
      </div>

      {/* Filters + Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-input)', borderRadius: 8, padding: 3 }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              style={{
                border: 'none', borderRadius: 6, padding: '6px 14px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: activeFilter === f.value ? 'var(--bg-card)' : 'transparent',
                color: activeFilter === f.value ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: activeFilter === f.value ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.12s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 300 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="input-field"
            placeholder="Search by project, client, or order ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 32, fontSize: 12.5, height: 34 }}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13, padding: '40px 0' }}>
          <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading orders…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4" strokeLinecap="round" style={{ marginBottom: 12 }}>
            <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M7 15h0M2 9.5h20" />
          </svg>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            {search.trim() ? 'No orders match your search' : 'No orders yet'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {search.trim() ? 'Try a different search term.' : 'Submit an order from a project cart to see it here.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((order) => {
            const st = STATUS_STYLES[order.status] ?? STATUS_STYLES.draft;
            return (
              <Link key={order.id} href={`/projects/${order.projectId}/orders/${order.id}`} style={{ textDecoration: 'none' }}>
                <div className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
                >
                  {/* Icon */}
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: st.bg, border: `1px solid ${st.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={st.color} strokeWidth="2" strokeLinecap="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M7 15h0M2 9.5h20" />
                    </svg>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                        #{order.id.slice(0, 8)}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {order.project?.name || 'Unknown project'}
                      {order.project?.client?.name && (
                        <span> &middot; {order.project.client.name}</span>
                      )}
                      {' \u00b7 '}{order._count.lineItems} item{order._count.lineItems !== 1 ? 's' : ''}
                      {' \u00b7 '}{order._count.brandPOs} brand{order._count.brandPOs !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Status */}
                  <div style={{ background: st.bg, border: `1px solid ${st.border}`, borderRadius: 999, padding: '3px 10px', fontSize: 10.5, color: st.color, fontWeight: 600, flexShrink: 0 }}>
                    {st.label}
                  </div>

                  {/* Total */}
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', flexShrink: 0, minWidth: 75, textAlign: 'right' }}>
                    {formatPrice(order.totalAmount)}
                  </div>

                  {/* Chevron */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
