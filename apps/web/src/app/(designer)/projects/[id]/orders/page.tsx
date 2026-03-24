'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, OrderSummary } from '@/lib/api';

function formatPrice(price: number | null) {
  if (price == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price);
}

const STATUS_CONFIG: Record<string, { accent: string; bg: string; border: string; color: string; label: string; icon: React.ReactNode }> = {
  draft: {
    accent: '#3850be', bg: 'rgba(50,80,190,0.06)', border: 'rgba(50,80,190,0.15)', color: '#3850be', label: 'Placed',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3850be" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  },
  submitted: {
    accent: '#3850be', bg: 'rgba(50,80,190,0.06)', border: 'rgba(50,80,190,0.15)', color: '#3850be', label: 'Placed',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3850be" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  },
  paid: {
    accent: 'var(--green)', bg: 'var(--green-dim)', border: 'var(--green-border)', color: 'var(--green)', label: 'Paid',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  },
  split_to_brands: {
    accent: 'var(--gold)', bg: 'rgba(168,113,10,0.06)', border: 'rgba(168,113,10,0.15)', color: 'var(--gold)', label: 'Processing',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  },
  closed: {
    accent: 'var(--text-muted)', bg: 'rgba(0,0,0,0.03)', border: 'rgba(0,0,0,0.08)', color: 'var(--text-muted)', label: 'Completed',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  },
};

type FilterTab = 'all' | 'placed' | 'paid' | 'processing' | 'completed';

const FILTER_MAP: Record<FilterTab, string[]> = {
  all: [],
  placed: ['draft', 'submitted'],
  paid: ['paid'],
  processing: ['split_to_brands'],
  completed: ['closed'],
};

export default function OrdersPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [hoveredOrder, setHoveredOrder] = useState<string | null>(null);
  const [hoveredTab, setHoveredTab] = useState<FilterTab | null>(null);

  useEffect(() => {
    api.getProjectOrders(projectId).then((r) => {
      if (!r.error) setOrders(r.data!);
      setLoading(false);
    });
  }, [projectId]);

  const stats = useMemo(() => {
    const total = orders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);
    const paidCount = orders.filter(o => o.status === 'paid' || o.status === 'split_to_brands' || o.status === 'closed').length;
    const unpaidCount = orders.filter(o => o.status === 'draft' || o.status === 'submitted').length;
    return { total, paidCount, unpaidCount, count: orders.length };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (activeTab === 'all') return orders;
    const statuses = FILTER_MAP[activeTab];
    return orders.filter(o => statuses.includes(o.status));
  }, [orders, activeTab]);

  const tabCounts = useMemo(() => ({
    all: orders.length,
    placed: orders.filter(o => o.status === 'draft' || o.status === 'submitted').length,
    paid: orders.filter(o => o.status === 'paid').length,
    processing: orders.filter(o => o.status === 'split_to_brands').length,
    completed: orders.filter(o => o.status === 'closed').length,
  }), [orders]);

  if (loading) {
    return (
      <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div style={{ padding: '80px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M7 15h0M2 9.5h20" />
          </svg>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>No orders yet</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 340, margin: '0 auto', lineHeight: 1.5 }}>
          Add items to your cart and submit an order to see it here.
        </div>
        <Link href={`/projects/${projectId}/cart`}
          style={{ display: 'inline-block', marginTop: 20, fontSize: 13, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>
          Go to Cart &rarr;
        </Link>
      </div>
    );
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'placed', label: 'Placed' },
    { key: 'paid', label: 'Paid' },
    { key: 'processing', label: 'Processing' },
    { key: 'completed', label: 'Completed' },
  ];

  return (
    <div style={{ padding: '28px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Orders</h2>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {stats.count} order{stats.count !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Total Value</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{formatPrice(stats.total)}</div>
        </div>
        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Paid</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>{stats.paidCount}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>of {stats.count}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Unpaid</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: stats.unpaidCount > 0 ? '#3850be' : 'var(--text-muted)' }}>{stats.unpaidCount}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>pending</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const isHovered = hoveredTab === tab.key;
          const count = tabCounts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              onMouseEnter={() => setHoveredTab(tab.key)}
              onMouseLeave={() => setHoveredTab(null)}
              style={{
                padding: '8px 14px',
                fontSize: 12.5,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                background: isHovered && !isActive ? 'rgba(0,0,0,0.03)' : 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--text-primary)' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: -1,
                borderRadius: '6px 6px 0 0',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
              {count > 0 && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  background: isActive ? 'var(--text-primary)' : 'var(--border)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  borderRadius: 999,
                  padding: '1px 6px',
                  minWidth: 18,
                  textAlign: 'center',
                  transition: 'all 0.15s',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Orders List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredOrders.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No orders in this category
          </div>
        ) : (
          filteredOrders.map((order) => {
            const st = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.draft;
            const isHovered = hoveredOrder === order.id;
            return (
              <Link key={order.id} href={`/projects/${projectId}/orders/${order.id}`} style={{ textDecoration: 'none' }}>
                <div
                  className="card"
                  onMouseEnter={() => setHoveredOrder(order.id)}
                  onMouseLeave={() => setHoveredOrder(null)}
                  style={{
                    display: 'flex',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    borderColor: isHovered ? 'var(--border-strong)' : undefined,
                    boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.06)' : undefined,
                  }}
                >
                  {/* Accent Bar */}
                  <div style={{ width: 4, flexShrink: 0, background: st.accent, borderRadius: '8px 0 0 8px' }} />

                  <div style={{ flex: 1, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* Status Icon */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: st.bg, border: `1px solid ${st.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {st.icon}
                    </div>

                    {/* Order Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                          #{order.id.slice(0, 8)}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          background: st.bg, border: `1px solid ${st.border}`,
                          color: st.color, borderRadius: 999, padding: '1px 8px',
                        }}>
                          {st.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span style={{ opacity: 0.4 }}>&middot;</span>
                        <span>{order._count.lineItems} item{order._count.lineItems !== 1 ? 's' : ''}</span>
                        <span style={{ opacity: 0.4 }}>&middot;</span>
                        <span>{order._count.brandPOs} brand{order._count.brandPOs !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', flexShrink: 0 }}>
                      {formatPrice(order.totalAmount)}
                    </div>

                    {/* Chevron */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{
                      flexShrink: 0, opacity: isHovered ? 1 : 0.4, transition: 'opacity 0.15s, transform 0.15s',
                      transform: isHovered ? 'translateX(2px)' : 'none',
                    }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
