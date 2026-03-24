'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, OrderDetail, BrandPO, Payment } from '@/lib/api';

/* ── Helpers ─────────────────────────────────────── */

function formatPrice(price: number | null) {
  if (price == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ── Timeline config ────────────────────────────── */

const TIMELINE_STEPS = [
  { key: 'order_placed', label: 'Order Placed', icon: 'receipt' },
  { key: 'sent', label: 'Sent to Brand', icon: 'send' },
  { key: 'acknowledged', label: 'Acknowledged', icon: 'check' },
  { key: 'in_production', label: 'In Production', icon: 'factory' },
  { key: 'dispatched', label: 'Dispatched', icon: 'truck' },
  { key: 'delivered', label: 'Delivered', icon: 'package' },
] as const;

const STATUS_ORDER: Record<string, number> = {
  order_placed: 0,
  sent: 1,
  acknowledged: 2,
  in_production: 3,
  dispatched: 4,
  delivered: 5,
};

function getEstimatedDelivery(order: OrderDetail, po: BrandPO): string {
  const created = new Date(order.createdAt);
  const status = po.status;
  let daysRemaining = 30;
  if (status === 'delivered') return 'Delivered';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'dispatched') daysRemaining = 5;
  else if (status === 'in_production') daysRemaining = 15;
  else if (status === 'acknowledged') daysRemaining = 22;
  else if (status === 'sent') daysRemaining = 28;

  const est = new Date(Math.max(created.getTime() + 30 * 86400000, Date.now() + daysRemaining * 86400000));
  return `~${est.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`;
}

function getStepIndex(poStatus: string): number {
  return STATUS_ORDER[poStatus] ?? 1;
}

/* ── Step icon SVGs ─────────────────────────────── */

function StepIcon({ type, active }: { type: string; active: boolean }) {
  const color = active ? '#fff' : 'var(--text-muted)';
  const size = 14;
  switch (type) {
    case 'receipt':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2-3-2z" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="14" y2="12" /></svg>;
    case 'send':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>;
    case 'check':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>;
    case 'factory':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M2 20h20V8l-6 4V8l-6 4V4H2z" /></svg>;
    case 'truck':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><rect x="1" y="3" width="15" height="13" rx="1" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>;
    case 'package':
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>;
    default:
      return null;
  }
}

/* ── Overall order progress ─────────────────────── */

const ORDER_PROGRESS_STEPS = [
  { key: 'placed', label: 'Placed' },
  { key: 'paid', label: 'Paid' },
  { key: 'processing', label: 'Processing' },
  { key: 'delivered', label: 'Delivered' },
];

function getOrderProgressIndex(order: OrderDetail): number {
  if (order.status === 'closed') return 3;
  if (order.status === 'split_to_brands') {
    const allDelivered = order.brandPOs.every(po => po.status === 'delivered');
    if (allDelivered) return 3;
    return 2;
  }
  if (order.status === 'paid') return 2;
  return 1; // paid minimum since this page only shows paid+
}

/* ══════════════════════════════════════════════════════
   Order Tracking Page
   ══════════════════════════════════════════════════════ */

export default function OrderTrackingPage() {
  const { id: projectId, orderId } = useParams<{ id: string; orderId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getOrder(projectId, orderId),
      api.getOrderPayments(orderId),
    ]).then(([orderRes, paymentRes]) => {
      if (orderRes.error || !orderRes.data) {
        router.replace(`/projects/${projectId}/orders`);
        return;
      }
      const o = orderRes.data;
      // Only allow paid+ orders
      if (o.status === 'draft' || o.status === 'submitted') {
        router.replace(`/projects/${projectId}/orders/${orderId}`);
        return;
      }
      setOrder(o);
      if (paymentRes.data && paymentRes.data.length > 0) setPayment(paymentRes.data[0]);
      setLoading(false);
    });
  }, [projectId, orderId, router]);

  if (loading || !order) {
    return (
      <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
      </div>
    );
  }

  const progressIdx = getOrderProgressIndex(order);
  const totalItems = order.lineItems.length;
  const uniqueBrands = order.brandPOs.length;

  return (
    <div style={{ padding: '28px 40px 60px', maxWidth: 1100 }}>
      {/* Back link */}
      <Link href={`/projects/${projectId}/orders/${orderId}`}
        style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        Back to Order
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Order Tracking
        </h2>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
          #{order.id.slice(0, 8)}
        </span>
      </div>

      {/* Overall progress bar */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          {/* Progress line */}
          <div style={{
            position: 'absolute', top: 14, left: 28, right: 28, height: 3,
            background: 'var(--border)', borderRadius: 2, zIndex: 0,
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: 'var(--green)',
              width: `${(progressIdx / (ORDER_PROGRESS_STEPS.length - 1)) * 100}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
          {ORDER_PROGRESS_STEPS.map((step, idx) => {
            const isComplete = idx <= progressIdx;
            const isCurrent = idx === progressIdx;
            return (
              <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, flex: idx === 0 || idx === ORDER_PROGRESS_STEPS.length - 1 ? 0 : 1 }}>
                <div style={{
                  width: isCurrent ? 30 : 26, height: isCurrent ? 30 : 26,
                  borderRadius: '50%',
                  background: isComplete ? 'var(--green)' : 'var(--bg-card)',
                  border: isComplete ? '3px solid var(--green)' : '3px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.3s',
                  boxShadow: isCurrent ? '0 0 0 4px var(--green-dim)' : 'none',
                }}>
                  {isComplete && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span style={{
                  fontSize: 10.5, fontWeight: isCurrent ? 700 : 500, marginTop: 8,
                  color: isComplete ? 'var(--green)' : 'var(--text-muted)',
                }}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main layout: left details + right timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT PANEL: Order Details ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 28 }}>

          {/* Order Info */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Order Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <InfoRow label="Order ID" value={`#${order.id.slice(0, 8)}`} />
              <InfoRow label="Date Placed" value={formatDateLong(order.createdAt)} />
              <InfoRow label="Total Items" value={`${totalItems} item${totalItems !== 1 ? 's' : ''}`} />
              <InfoRow label="Brands" value={`${uniqueBrands} brand${uniqueBrands !== 1 ? 's' : ''}`} />
              <div style={{ borderTop: '1px solid var(--border)', margin: '2px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Total Amount</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{formatPrice(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Payment</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>Payment Confirmed</span>
              </div>
              {payment && (
                <>
                  <InfoRow label="Paid On" value={formatDate(payment.createdAt)} />
                  <InfoRow label="Amount" value={formatPrice(payment.amount)} />
                  <InfoRow label="Method" value={payment.paymentMethod ?? 'Card'} />
                  {payment.stripePaymentIntentId && (
                    <InfoRow label="Transaction" value={payment.stripePaymentIntentId.slice(0, 16) + '...'} mono />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Items Summary */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Items</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {order.lineItems.slice(0, 6).map((li) => (
                <div key={li.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
                    background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {li.product.imageUrl ? (
                      <img src={li.product.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4">
                        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {li.product.productName}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>x{li.quantity}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
                    {formatPrice(li.lineTotal)}
                  </div>
                </div>
              ))}
              {order.lineItems.length > 6 && (
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500, paddingTop: 4 }}>
                  +{order.lineItems.length - 6} more item{order.lineItems.length - 6 !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: Brand Timelines ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {order.brandPOs.map((po) => {
            const currentStepIdx = getStepIndex(po.status);
            const isCancelled = po.status === 'cancelled';
            const estDelivery = getEstimatedDelivery(order, po);

            return (
              <div key={po.id} className="card" style={{ overflow: 'hidden' }}>
                {/* PO Header */}
                <div style={{
                  padding: '16px 22px', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg-surface)',
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{po.brandName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {po.lineItems.length} item{po.lineItems.length !== 1 ? 's' : ''} &middot; {formatPrice(po.subtotal)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Est. Delivery</div>
                    <div style={{
                      fontSize: 14, fontWeight: 700, marginTop: 2,
                      color: po.status === 'delivered' ? 'var(--green)' : isCancelled ? '#b91c1c' : 'var(--text-primary)',
                    }}>
                      {estDelivery}
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div style={{ padding: '22px 26px' }}>
                  {isCancelled ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '16px 20px', borderRadius: 10,
                      background: 'rgba(180,30,30,0.06)', border: '1px solid rgba(180,30,30,0.15)',
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>Order Cancelled</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>This brand purchase order has been cancelled.</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {TIMELINE_STEPS.map((step, idx) => {
                        const isComplete = idx <= currentStepIdx;
                        const isCurrent = idx === currentStepIdx;
                        const isLast = idx === TIMELINE_STEPS.length - 1;
                        let dateLabel = '';
                        if (idx === 0) dateLabel = formatDate(order.createdAt);
                        else if (idx === 1 && isComplete) dateLabel = formatDate(po.createdAt);
                        else if (isCurrent && idx > 1) dateLabel = 'Current';

                        return (
                          <div key={step.key}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                              {/* Node */}
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                background: isComplete ? 'var(--green)' : 'var(--bg-input)',
                                border: isComplete ? '2px solid var(--green)' : '2px solid var(--border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.3s',
                                boxShadow: isCurrent ? '0 0 0 4px var(--green-dim)' : 'none',
                              }}>
                                <StepIcon type={step.icon} active={isComplete} />
                              </div>

                              {/* Label */}
                              <div style={{ flex: 1 }}>
                                <div style={{
                                  fontSize: 13, fontWeight: isComplete ? 700 : 500,
                                  color: isComplete ? 'var(--text-primary)' : 'var(--text-muted)',
                                }}>
                                  {step.label}
                                </div>
                                {dateLabel && (
                                  <div style={{ fontSize: 11, color: isCurrent && idx > 1 ? 'var(--green)' : 'var(--text-muted)', marginTop: 1, fontWeight: isCurrent ? 600 : 400 }}>
                                    {dateLabel}
                                  </div>
                                )}
                              </div>

                              {/* Checkmark for completed */}
                              {isComplete && !isCurrent && (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>

                            {/* Connector line */}
                            {!isLast && (
                              <div style={{
                                width: 2, height: 28, marginLeft: 15, marginTop: 4, marginBottom: 4,
                                background: idx < currentStepIdx ? 'var(--green)' : 'var(--border)',
                                borderRadius: 1,
                                transition: 'background 0.3s',
                              }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* PO Items mini-list */}
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 22px', background: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {po.lineItems.map((li) => (
                      <div key={li.id} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: '4px 10px 4px 4px',
                      }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: 4, overflow: 'hidden', flexShrink: 0,
                          background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {li.product.imageUrl ? (
                            <img src={li.product.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                            </svg>
                          )}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {li.product.productName}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>x{li.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Estimate disclaimer */}
          <div style={{
            fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic',
            padding: '8px 0', textAlign: 'center',
          }}>
            Estimated delivery dates are approximate and may vary based on brand production timelines.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Shared sub-component ────────────────────────── */

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{
        fontSize: mono ? 11 : 12.5, fontWeight: 600, color: 'var(--text-primary)',
        fontFamily: mono ? 'monospace' : 'inherit',
      }}>
        {value}
      </span>
    </div>
  );
}
