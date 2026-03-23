'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, OrderSummary } from '@/lib/api';

function formatPrice(price: number | null) {
  if (price == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price);
}

const ORDER_STATUS_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  draft:           { bg: 'rgba(50,80,190,0.07)', border: 'rgba(50,80,190,0.18)', color: '#3850be',             label: 'Placed' },
  submitted:       { bg: 'rgba(50,80,190,0.07)', border: 'rgba(50,80,190,0.18)', color: '#3850be',             label: 'Placed' },
  paid:            { bg: 'var(--green-dim)',      border: 'var(--green-border)',   color: 'var(--green)',        label: 'Paid' },
  split_to_brands: { bg: 'rgba(168,113,10,0.08)', border: 'rgba(168,113,10,0.2)', color: 'var(--gold)',        label: 'Processing' },
  closed:          { bg: 'rgba(0,0,0,0.04)',     border: 'rgba(0,0,0,0.09)',     color: 'var(--text-muted)',   label: 'Completed' },
};

export default function OrdersPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProjectOrders(projectId).then((r) => {
      if (!r.error) setOrders(r.data!);
      setLoading(false);
    });
  }, [projectId]);

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

  return (
    <div style={{ padding: '28px 40px' }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 20px' }}>Orders</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {orders.map((order) => {
          const st = ORDER_STATUS_STYLES[order.status] ?? ORDER_STATUS_STYLES.draft;
          return (
            <Link key={order.id} href={`/projects/${projectId}/orders/${order.id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
              >
                {/* Order icon */}
                <div style={{ width: 40, height: 40, borderRadius: 10, background: st.bg, border: `1px solid ${st.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={st.color} strokeWidth="2" strokeLinecap="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M7 15h0M2 9.5h20" />
                  </svg>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Order #{order.id.slice(0, 8)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' \u00b7 '}{order._count.lineItems} item{order._count.lineItems !== 1 ? 's' : ''}
                    {' \u00b7 '}{order._count.brandPOs} brand{order._count.brandPOs !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Total + Status */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatPrice(order.totalAmount)}
                  </div>
                  <div style={{ background: st.bg, border: `1px solid ${st.border}`, borderRadius: 999, padding: '2px 9px', fontSize: 10.5, color: st.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {st.label}
                  </div>
                </div>

                {/* Chevron */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
