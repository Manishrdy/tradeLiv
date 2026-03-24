'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, OrderDetail, Payment } from '@/lib/api';

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

const PO_STATUS_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  sent:           { bg: 'rgba(50,80,190,0.07)', border: 'rgba(50,80,190,0.18)', color: '#3850be',           label: 'Sent' },
  acknowledged:   { bg: 'rgba(168,113,10,0.08)', border: 'rgba(168,113,10,0.2)', color: 'var(--gold)',      label: 'Acknowledged' },
  in_production:  { bg: 'rgba(168,113,10,0.08)', border: 'rgba(168,113,10,0.2)', color: 'var(--gold)',      label: 'In Production' },
  dispatched:     { bg: 'var(--green-dim)',      border: 'var(--green-border)',   color: 'var(--green)',      label: 'Dispatched' },
  delivered:      { bg: 'var(--green-dim)',      border: 'var(--green-border)',   color: 'var(--green)',      label: 'Delivered' },
  cancelled:      { bg: 'rgba(180,30,30,0.07)', border: 'rgba(180,30,30,0.18)', color: '#b91c1c',           label: 'Cancelled' },
};

const PO_STATUS_OPTIONS = [
  { value: 'sent',           label: 'Sent' },
  { value: 'acknowledged',   label: 'Acknowledged' },
  { value: 'in_production',  label: 'In Production' },
  { value: 'dispatched',     label: 'Dispatched' },
  { value: 'delivered',      label: 'Delivered' },
  { value: 'cancelled',      label: 'Cancelled' },
];

function PoStatusDropdown({ orderId, poId, currentStatus, onStatusChange }: {
  orderId: string; poId: string; currentStatus: string;
  onStatusChange: (poId: string, newStatus: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const poSt = PO_STATUS_STYLES[currentStatus] ?? PO_STATUS_STYLES.sent;

  async function handleSelect(status: string) {
    setOpen(false);
    onStatusChange(poId, status);
    await api.updateBrandPoStatus(orderId, poId, status);
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)}
        style={{
          background: poSt.bg, border: `1px solid ${poSt.border}`, borderRadius: 999,
          padding: '3px 10px', fontSize: 11, color: poSt.color, fontWeight: 600,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
        }}
      >
        {poSt.label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 51,
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 160, overflow: 'hidden',
          }}>
            {PO_STATUS_OPTIONS.map((opt) => {
              const optSt = PO_STATUS_STYLES[opt.value] ?? PO_STATUS_STYLES.sent;
              const isCurrent = opt.value === currentStatus;
              return (
                <button key={opt.value} onClick={() => handleSelect(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '8px 14px', border: 'none', background: isCurrent ? 'var(--bg-input)' : 'transparent',
                    cursor: 'pointer', fontSize: 12, fontWeight: isCurrent ? 700 : 500,
                    color: 'var(--text-primary)', textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-input)'; }}
                  onMouseLeave={(e) => { if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: optSt.color, flexShrink: 0 }} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function OrderDetailPage() {
  const { id: projectId, orderId } = useParams<{ id: string; orderId: string }>();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [payingNow, setPayingNow] = useState(false);

  function handlePoStatusChange(poId: string, newStatus: string) {
    setOrder((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        brandPOs: prev.brandPOs.map((po) => po.id === poId ? { ...po, status: newStatus } : po),
      };
    });
  }

  useEffect(() => {
    if (searchParams.get('payment') === 'success') setPaymentSuccess(true);

    api.getOrder(projectId, orderId).then((r) => {
      if (r.error) setNotFound(true);
      else setOrder(r.data!);
      setLoading(false);
    });

    api.getOrderPayments(orderId).then((r) => {
      if (r.data && r.data.length > 0) setPayment(r.data[0]);
    });
  }, [projectId, orderId, searchParams]);

  async function handleCompletePayment() {
    setPayingNow(true);
    const r = await api.createCheckoutSession(orderId);
    if (r.error) { setPayingNow(false); return; }
    window.location.href = r.data!.sessionUrl;
  }

  if (loading) {
    return (
      <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div style={{ padding: '80px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Order not found</div>
        <Link href={`/projects/${projectId}/orders`}
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>
          &larr; Back to Orders
        </Link>
      </div>
    );
  }

  const st = ORDER_STATUS_STYLES[order.status] ?? ORDER_STATUS_STYLES.draft;

  return (
    <div style={{ padding: '28px 40px 60px' }}>
      {/* Payment success banner */}
      {paymentSuccess && (
        <div style={{
          background: 'var(--green-dim)', border: '1px solid var(--green-border)', borderRadius: 10,
          padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--green)' }}>Payment successful! Your order is being processed.</span>
          <button onClick={() => setPaymentSuccess(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', fontSize: 16 }}>&times;</button>
        </div>
      )}

      {/* Back link */}
      <Link href={`/projects/${projectId}/orders`}
        style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        All Orders
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Order #{order.id.slice(0, 8)}
        </h2>
        <div style={{ background: st.bg, border: `1px solid ${st.border}`, borderRadius: 999, padding: '3px 10px', fontSize: 11, color: st.color, fontWeight: 600 }}>
          {st.label}
        </div>
        <div style={{ flex: 1 }} />
        {order.status !== 'closed' && (
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Need help with this order? Contact support.
          </span>
        )}
      </div>

      {/* Order meta */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Date</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
              {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Items</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{order.lineItems.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Total</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{formatPrice(order.totalAmount)}</div>
          </div>
        </div>

        {/* Complete Payment button for draft orders */}
        {order.status === 'draft' && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button className="btn-primary" onClick={handleCompletePayment} disabled={payingNow}
              style={{ width: '100%', padding: '10px 0', fontSize: 13.5, fontWeight: 700 }}>
              {payingNow ? 'Redirecting to payment...' : 'Complete Payment'}
            </button>
          </div>
        )}
      </div>

      {/* Brand Purchase Orders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {order.brandPOs.map((po) => {
          return (
            <div key={po.id} className="card" style={{ overflow: 'hidden' }}>
              {/* PO Header */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{po.brandName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {po.lineItems.length} item{po.lineItems.length !== 1 ? 's' : ''} &middot; Subtotal: {formatPrice(po.subtotal)}
                  </div>
                </div>
                <PoStatusDropdown orderId={orderId} poId={po.id} currentStatus={po.status} onStatusChange={handlePoStatusChange} />
              </div>

              {/* PO Line Items */}
              {po.lineItems.map((li, idx) => (
                <div key={li.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
                  borderBottom: idx < po.lineItems.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  {/* Image */}
                  <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-input)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {li.product.imageUrl ? (
                      <img src={li.product.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4">
                        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                      </svg>
                    )}
                  </div>

                  {/* Name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {li.product.productName}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>
                      {li.room.name}
                      {li.product.category && ` \u00b7 ${li.product.category}`}
                    </div>
                  </div>

                  {/* Qty */}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, width: 40, textAlign: 'center' }}>
                    x{li.quantity}
                  </div>

                  {/* Unit price */}
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0, width: 70, textAlign: 'right' }}>
                    {formatPrice(li.unitPrice)}
                  </div>

                  {/* Line total */}
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0, width: 80, textAlign: 'right' }}>
                    {formatPrice(li.lineTotal)}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Order Total Footer */}
      <div className="card" style={{ marginTop: 24, padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Order Total</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{formatPrice(order.totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}
