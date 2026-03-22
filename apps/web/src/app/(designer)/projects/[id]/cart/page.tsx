'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, CartItem } from '@/lib/api';

function formatPrice(price: number | null) {
  if (price == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price);
}

export default function CartPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();

  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadCart = useCallback(async () => {
    const r = await api.getCart(projectId);
    if (!r.error) setItems(r.data!);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadCart(); }, [loadCart]);

  async function handleUpdateQty(itemId: string, qty: number) {
    if (qty < 1) return;
    setUpdatingId(itemId);
    const r = await api.updateCartItem(projectId, itemId, { quantity: qty });
    if (!r.error) {
      setItems((prev) => prev.map((i) => i.id === itemId ? r.data! : i));
    }
    setUpdatingId(null);
  }

  async function handleRemove(itemId: string) {
    setUpdatingId(itemId);
    await api.removeCartItem(projectId, itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setUpdatingId(null);
  }

  async function handlePayNow() {
    setSubmitting(true);
    setError(null);

    // 1. Create the order (status: draft)
    const orderRes = await api.createOrder(projectId);
    if (orderRes.error) {
      setError(orderRes.error);
      setSubmitting(false);
      return;
    }

    // 2. Create Stripe checkout session and redirect
    const sessionRes = await api.createCheckoutSession(orderRes.data!.id);
    if (sessionRes.error) {
      setError(sessionRes.error);
      setSubmitting(false);
      return;
    }

    window.location.href = sessionRes.data!.sessionUrl;
  }

  // Group items by room
  const grouped = items.reduce<Record<string, { roomName: string; items: CartItem[] }>>((acc, item) => {
    const key = item.roomId;
    if (!acc[key]) acc[key] = { roomName: item.room?.name || 'Unknown Room', items: [] };
    acc[key].items.push(item);
    return acc;
  }, {});

  const subtotal = items.reduce((sum, i) => sum + (i.unitPrice ?? 0) * i.quantity, 0);

  if (loading) {
    return (
      <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: '80px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Your cart is empty</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 340, margin: '0 auto', lineHeight: 1.5 }}>
          Add approved items from your room shortlists to start building an order.
        </div>
        <Link href={`/projects/${projectId}/rooms`}
          style={{ display: 'inline-block', marginTop: 20, fontSize: 13, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>
          Go to Rooms &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 40px 80px' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Cart</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{items.length} item{items.length !== 1 ? 's' : ''} across {Object.keys(grouped).length} room{Object.keys(grouped).length !== 1 ? 's' : ''}</p>
      </div>

      {/* Items grouped by room */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {Object.entries(grouped).map(([roomId, group]) => (
          <div key={roomId} className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {group.roomName}
              </span>
            </div>

            {group.items.map((item, idx) => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                borderBottom: idx < group.items.length - 1 ? '1px solid var(--border)' : 'none',
                opacity: updatingId === item.id ? 0.5 : 1, transition: 'opacity 0.15s',
              }}>
                {/* Image */}
                <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-input)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.product.imageUrl ? (
                    <img src={item.product.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                    </svg>
                  )}
                </div>

                {/* Product info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.product.productName}
                  </div>
                  {item.product.brandName && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{item.product.brandName}</div>
                  )}
                </div>

                {/* Unit price */}
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0, width: 80, textAlign: 'right' }}>
                  {formatPrice(item.unitPrice)}
                </div>

                {/* Quantity controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
                  <button onClick={() => handleUpdateQty(item.id, item.quantity - 1)} disabled={item.quantity <= 1 || updatingId === item.id}
                    style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: '6px 0 0 6px', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    &minus;
                  </button>
                  <div style={{ width: 36, height: 28, border: '1px solid var(--border)', borderLeft: 'none', borderRight: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', background: 'var(--bg-card)' }}>
                    {item.quantity}
                  </div>
                  <button onClick={() => handleUpdateQty(item.id, item.quantity + 1)} disabled={updatingId === item.id}
                    style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: '0 6px 6px 0', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    +
                  </button>
                </div>

                {/* Line total */}
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', flexShrink: 0, width: 90, textAlign: 'right' }}>
                  {formatPrice((item.unitPrice ?? 0) * item.quantity)}
                </div>

                {/* Remove */}
                <button onClick={() => handleRemove(item.id)} disabled={updatingId === item.id}
                  title="Remove from cart"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', flexShrink: 0 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#b91c1c'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Summary + Submit */}
      <div className="card" style={{ marginTop: 24, padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Subtotal</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{formatPrice(subtotal)}</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 20 }}>
          Tax and shipping calculated at payment.
        </div>

        {error && (
          <div className="error-box" style={{ marginBottom: 14 }}>{error}</div>
        )}

        <button className="btn-primary" onClick={handlePayNow} disabled={submitting}
          style={{ width: '100%', padding: '12px 0', fontSize: 14, fontWeight: 700 }}>
          {submitting ? 'Redirecting to payment...' : 'Pay Now'}
        </button>
      </div>
    </div>
  );
}
