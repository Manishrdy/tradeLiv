'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, OrderSummaryGlobal } from '@/lib/api';

/* ── Constants ─────────────────────────────────────── */

const STATUS_FILTERS = [
  { label: 'All',        value: '',               color: '#111' },
  { label: 'Unpaid',     value: 'draft',          color: '#8C8984' },
  { label: 'Paid',       value: 'paid',           color: '#2d7a4f' },
  { label: 'Processing', value: 'split_to_brands', color: '#9E7C3F' },
  { label: 'Closed',     value: 'closed',         color: '#555' },
];

const STATUS_STYLES: Record<string, { bg: string; border: string; color: string; label: string; dot: string }> = {
  draft:           { bg: 'rgba(0,0,0,0.04)',      border: 'rgba(0,0,0,0.09)',      color: '#8C8984',   label: 'Unpaid',     dot: '#B0ADA8' },
  submitted:       { bg: 'rgba(37,99,235,0.07)',  border: 'rgba(37,99,235,0.18)',  color: '#2563eb',   label: 'Submitted',  dot: '#2563eb' },
  paid:            { bg: 'var(--green-dim)',       border: 'var(--green-border)',    color: 'var(--green)', label: 'Paid',    dot: '#2d7a4f' },
  split_to_brands: { bg: 'rgba(158,124,63,0.08)', border: 'rgba(158,124,63,0.2)',  color: 'var(--gold)',  label: 'Processing', dot: '#9E7C3F' },
  closed:          { bg: 'rgba(0,0,0,0.04)',      border: 'rgba(0,0,0,0.09)',      color: '#555',      label: 'Closed',     dot: '#555' },
};

const PROGRESS_STEPS = ['draft', 'paid', 'split_to_brands', 'closed'];
const PROGRESS_LABELS: Record<string, string> = {
  draft: 'Placed', paid: 'Paid', split_to_brands: 'Processing', closed: 'Completed',
};

/* ── Helpers ───────────────────────────────────────── */

function formatPrice(price: number | null) {
  if (price == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Progress tracker ──────────────────────────────── */

function OrderProgress({ status }: { status: string }) {
  const currentIdx = PROGRESS_STEPS.indexOf(status);
  const activeIdx = currentIdx >= 0 ? currentIdx : 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%' }}>
      {PROGRESS_STEPS.map((step, i) => {
        const isDone = i <= activeIdx;
        const isActive = i === activeIdx;
        const color = isDone ? (STATUS_STYLES[step]?.dot ?? '#111') : '#D4D1CC';
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < PROGRESS_STEPS.length - 1 ? 1 : undefined }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{
                width: isActive ? 10 : 8, height: isActive ? 10 : 8,
                borderRadius: '50%', background: color,
                border: isActive ? `2px solid ${color}40` : 'none',
                transition: 'all 0.2s',
              }} />
              <span style={{
                fontSize: 9, fontWeight: isDone ? 700 : 500,
                color: isDone ? color : '#D4D1CC',
                whiteSpace: 'nowrap',
              }}>
                {PROGRESS_LABELS[step]}
              </span>
            </div>
            {i < PROGRESS_STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, borderRadius: 999,
                background: i < activeIdx ? color : '#E8E5E0',
                margin: '0 4px', marginBottom: 16,
                transition: 'background 0.3s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Orders Page
   ══════════════════════════════════════════════════════ */

export default function OrdersPage() {
  const [orders, setOrders]           = useState<OrderSummaryGlobal[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeFilter, setActiveFilter] = useState('');
  const [search, setSearch]           = useState('');

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

  /* ── Generate invoice text (simple) ──────────────── */
  function downloadInvoice(order: OrderSummaryGlobal) {
    const lines = [
      'INVOICE',
      '═══════════════════════════════════════',
      '',
      `Order ID:    #${order.id.slice(0, 8)}`,
      `Date:        ${formatDate(order.createdAt)}`,
      `Status:      ${STATUS_STYLES[order.status]?.label ?? order.status}`,
      '',
      `Project:     ${order.project?.name ?? '—'}`,
      `Client:      ${order.project?.client?.name ?? '—'}`,
      '',
      `Items:       ${order._count.lineItems}`,
      `Brand POs:   ${order._count.brandPOs}`,
      '',
      '───────────────────────────────────────',
      `TOTAL:       ${formatPrice(order.totalAmount)}`,
      '───────────────────────────────────────',
      '',
      'Generated by Tradeliv',
      `${new Date().toISOString()}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${order.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: '32px 44px', maxWidth: 1100 }}>

      {/* ── Header ──────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.035em' }}>Orders</h1>
        {!loading && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {orders.length} order{orders.length !== 1 ? 's' : ''}
            {activeFilter && ` · ${STATUS_STYLES[activeFilter]?.label ?? activeFilter}`}
          </p>
        )}
      </div>

      {/* ── Filters + Search ────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {/* Colored pill filters */}
        <div style={{ display: 'flex', gap: 5 }}>
          {STATUS_FILTERS.map((f) => {
            const isActive = activeFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  border: `1px solid ${isActive ? f.color + '30' : 'var(--border)'}`,
                  background: isActive ? f.color + '0C' : 'transparent',
                  color: isActive ? f.color : 'var(--text-muted)',
                  borderRadius: 999, padding: '5px 14px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit',
                }}
              >
                {f.value && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? f.color : 'transparent' }} />
                )}
                {f.label}
              </button>
            );
          })}
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
            style={{ paddingLeft: 32, fontSize: 12.5 }}
          />
        </div>
      </div>

      {/* ── Content ─────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13, padding: '40px 0' }}>
          <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading orders…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '72px 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: '0 auto 18px',
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.6" strokeLinecap="round">
              <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M7 15h0M2 9.5h20" />
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            {search.trim() ? 'No orders match your search' : 'No orders yet'}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 300, margin: '0 auto' }}>
            {search.trim() ? 'Try a different search term.' : 'Submit an order from a project cart to see it here.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((order, i) => {
            const st = STATUS_STYLES[order.status] ?? STATUS_STYLES.draft;
            return (
              <div
                key={order.id}
                className="card"
                style={{
                  overflow: 'hidden',
                  background: i % 2 === 0 ? 'var(--bg-card)' : '#FCFCFA',
                  transition: 'transform 0.12s, box-shadow 0.12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              >
                <Link href={`/projects/${order.projectId}/orders/${order.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}>
                    {/* Icon */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: st.bg, border: `1px solid ${st.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={st.color} strokeWidth="2" strokeLinecap="round">
                        <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M7 15h0M2 9.5h20" />
                      </svg>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                          #{order.id.slice(0, 8)}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {formatDate(order.createdAt)}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {order.project?.name || 'Unknown project'}
                        {order.project?.client?.name && <span> · {order.project.client.name}</span>}
                        {' · '}{order._count.lineItems} item{order._count.lineItems !== 1 ? 's' : ''}
                        {' · '}{order._count.brandPOs} brand{order._count.brandPOs !== 1 ? 's' : ''}
                      </div>
                    </div>

                    {/* Progress tracker (mini) */}
                    <div style={{ width: 140, flexShrink: 0 }}>
                      <OrderProgress status={order.status} />
                    </div>

                    {/* Status badge */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: st.bg, border: `1px solid ${st.border}`,
                      borderRadius: 999, padding: '4px 11px',
                      fontSize: 10.5, color: st.color, fontWeight: 700, flexShrink: 0,
                    }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot }} />
                      {st.label}
                    </div>

                    {/* Total */}
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', flexShrink: 0, minWidth: 85, textAlign: 'right', letterSpacing: '-0.01em' }}>
                      {formatPrice(order.totalAmount)}
                    </div>

                    {/* Chevron */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </Link>

                {/* Action buttons row */}
                <div style={{
                  display: 'flex', gap: 8, padding: '0 20px 12px',
                  borderTop: 'none',
                }}>
                  <button
                    onClick={() => downloadInvoice(order)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'none', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '4px 10px',
                      fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Invoice
                  </button>
                  <Link
                    href={`/projects/${order.projectId}/cart`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'none', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '4px 10px',
                      fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                      textDecoration: 'none',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="17 1 21 5 17 9" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    </svg>
                    Reorder
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
