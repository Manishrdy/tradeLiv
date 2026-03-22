'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, AdminOrderDetail } from '@/lib/api';

const ORDER_STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  draft:           { color: '#555',    bg: '#f0f0f0', label: 'Draft' },
  submitted:       { color: '#7a5c2d', bg: '#fdf5e6', label: 'Submitted' },
  paid:            { color: '#2d7a4f', bg: '#e8f5ee', label: 'Paid' },
  split_to_brands: { color: '#2d5f7a', bg: '#e6f0fd', label: 'Processing' },
  closed:          { color: '#555',    bg: '#f0f0f0', label: 'Closed' },
};

const PO_STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  sent:          { color: '#7a5c2d', bg: '#fdf5e6', label: 'Sent' },
  acknowledged:  { color: '#2d5f7a', bg: '#e6f0fd', label: 'Acknowledged' },
  in_production: { color: '#6b2d7a', bg: '#f3e6fd', label: 'In Production' },
  dispatched:    { color: '#2d7a4f', bg: '#e8f5ee', label: 'Dispatched' },
  delivered:     { color: '#2d7a4f', bg: '#e8f5ee', label: 'Delivered' },
  cancelled:     { color: '#8b2635', bg: '#fdecea', label: 'Cancelled' },
};

function StatusBadge({ status, styles }: { status: string; styles: Record<string, { color: string; bg: string; label: string }> }) {
  const s = styles[status] ?? { color: '#555', bg: '#f0f0f0', label: status };
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

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder]     = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusChanging, setStatusChanging] = useState(false);

  useEffect(() => {
    api.getAdminOrder(orderId).then((r) => {
      if (r.data) setOrder(r.data);
      setLoading(false);
    });
  }, [orderId]);

  async function handleStatusChange(newStatus: string) {
    if (!confirm(`Change order status to "${newStatus}"?`)) return;
    setStatusChanging(true);
    const r = await api.updateAdminOrderStatus(orderId, newStatus);
    if (!r.error) {
      setOrder((prev) => prev ? { ...prev, status: newStatus } : prev);
    }
    setStatusChanging(false);
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

  if (!order) {
    return (
      <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        Order not found.{' '}
        <Link href="/admin/orders" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Back to orders</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 40px 80px' }}>

      {/* Back + Header */}
      <button onClick={() => router.push('/admin/orders')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, padding: 0 }}>
        ← Back to orders
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
          Order <span style={{ fontFamily: 'monospace' }}>{order.id.slice(0, 8)}</span>
        </h1>
        <StatusBadge status={order.status} styles={ORDER_STATUS_STYLE} />
        {/* Status change dropdown */}
        <select
          value={order.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={statusChanging}
          className="input-field"
          style={{ fontSize: 12, padding: '6px 10px', width: 'auto', marginLeft: 'auto' }}
        >
          {Object.entries(ORDER_STATUS_STYLE).map(([v, s]) => (
            <option key={v} value={v}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Meta */}
      <div className="card" style={{ padding: '20px 22px', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 18 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Designer</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{order.designer.fullName}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Project</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{order.project.name}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Client</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{order.project.client?.name ?? '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Total</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{formatCurrency(order.totalAmount)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Date</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{new Date(order.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 12 }}>
          Line Items ({order.lineItems.length})
        </h2>
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Product', 'Brand', 'Room', 'Qty', 'Unit Price', 'Total'].map((h) => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: 'left',
                    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {order.lineItems.map((li) => (
                <tr key={li.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {li.product.imageUrl && (
                      <img src={li.product.imageUrl} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                    )}
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{li.product.productName}</span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{li.product.brandName ?? '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>{li.room.name}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-primary)', textAlign: 'center' }}>{li.quantity}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>{formatCurrency(li.unitPrice)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(li.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Brand POs */}
      {order.brandPOs.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 12 }}>
            Brand Purchase Orders ({order.brandPOs.length})
          </h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {order.brandPOs.map((po) => (
              <div key={po.id} className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{po.brandName}</span>
                    <StatusBadge status={po.status} styles={PO_STATUS_STYLE} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{po.lineItems.length} items</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(po.subtotal)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payments */}
      {order.payments.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 12 }}>
            Payments ({order.payments.length})
          </h2>
          <div className="card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Amount', 'Currency', 'Status', 'Method', 'Stripe Ref', 'Date'].map((h) => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left',
                      fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.payments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(p.amount)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{p.currency}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase',
                        color: p.status === 'paid' ? '#2d7a4f' : p.status === 'failed' ? '#8b2635' : '#7a5c2d',
                        background: p.status === 'paid' ? '#e8f5ee' : p.status === 'failed' ? '#fdecea' : '#fdf5e6',
                      }}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--text-muted)' }}>{p.paymentMethod ?? '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {p.stripePaymentIntentId?.slice(0, 16) ?? '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--text-muted)' }}>
                      {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Trail */}
      {order.auditLogs && order.auditLogs.length > 0 && (
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 12 }}>
            Audit Trail
          </h2>
          <div className="card" style={{ padding: '16px 20px' }}>
            {order.auditLogs.map((log) => (
              <div key={log.id} style={{
                padding: '8px 0', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {log.action.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 8 }}>
                    by {log.actorType}
                  </span>
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {new Date(log.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
