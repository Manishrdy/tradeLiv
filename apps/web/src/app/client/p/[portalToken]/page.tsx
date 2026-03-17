'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { api, PortalProject, PortalShortlistItem, PortalRoom } from '@/lib/api';

/* ─── Helpers ─────────────────────────────────────── */

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    draft:           { bg: 'var(--bg-input)',      color: 'var(--text-muted)',   label: 'Draft' },
    active:          { bg: 'var(--green-dim)',      color: 'var(--green)',        label: 'Active' },
    ordered:         { bg: 'rgba(56,80,190,0.08)', color: '#3850be',             label: 'Ordered' },
    closed:          { bg: 'var(--bg-input)',      color: 'var(--text-muted)',   label: 'Closed' },
    suggested:       { bg: 'var(--gold-dim)',       color: 'var(--gold)',         label: 'Pending' },
    approved:        { bg: 'var(--green-dim)',      color: 'var(--green)',        label: 'Approved' },
    rejected:        { bg: 'rgba(153,27,27,0.07)', color: '#991B1B',             label: 'Rejected' },
    added_to_cart:   { bg: 'rgba(56,80,190,0.08)', color: '#3850be',             label: 'In Cart' },
    submitted:       { bg: 'rgba(56,80,190,0.08)', color: '#3850be',             label: 'Submitted' },
    paid:            { bg: 'var(--green-dim)',      color: 'var(--green)',        label: 'Paid' },
    split_to_brands: { bg: 'rgba(91,33,182,0.07)', color: '#5B21B6',             label: 'Processing' },
  };
  const s = map[status] ?? map.draft;
  return (
    <span style={{
      background: s.bg, color: s.color,
      borderRadius: 999, padding: '2px 10px',
      fontSize: 11, fontWeight: 700, letterSpacing: '0.03em',
      display: 'inline-block',
    }}>
      {s.label}
    </span>
  );
}

/* ─── Shortlist item card ─────────────────────────── */

function ShortlistCard({
  item,
  portalToken,
  onUpdate,
}: {
  item: PortalShortlistItem;
  portalToken: string;
  onUpdate: (updated: PortalShortlistItem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [noteValue, setNoteValue] = useState(item.clientNotes ?? '');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleStatusChange(status: 'approved' | 'rejected') {
    const optimistic = { ...item, status };
    onUpdate(optimistic);
    const res = await api.updatePortalShortlistItem(portalToken, item.id, { status });
    if (res.error) onUpdate(item);
  }

  async function handleNoteSave() {
    if (noteValue === (item.clientNotes ?? '')) { setEditing(false); return; }
    setSaving(true);
    const optimistic = { ...item, clientNotes: noteValue };
    onUpdate(optimistic);
    const res = await api.updatePortalShortlistItem(portalToken, item.id, { clientNotes: noteValue });
    setSaving(false);
    if (res.error) {
      onUpdate(item);
      setNoteValue(item.clientNotes ?? '');
    }
    setEditing(false);
  }

  const isApproved = item.status === 'approved';
  const isRejected = item.status === 'rejected';

  const cardBorder = isApproved
    ? 'var(--green-border)'
    : isRejected
    ? 'rgba(153,27,27,0.18)'
    : 'var(--border)';

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${cardBorder}`,
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Image */}
        <div style={{ width: 96, flexShrink: 0, background: 'var(--bg-input)', position: 'relative', minHeight: 96 }}>
          {item.product.imageUrl ? (
            <img
              src={item.product.imageUrl}
              alt={item.product.productName}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 96 }}
            />
          ) : (
            <div style={{ width: '100%', minHeight: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '14px 16px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                {item.product.productName}
              </div>
              {item.product.brandName && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.product.brandName}</div>
              )}
            </div>
            {statusBadge(item.status)}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            {item.product.price != null && (
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                ${item.product.price.toLocaleString('en-US')}
              </div>
            )}
            {item.quantity > 1 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                Qty: {item.quantity}
              </div>
            )}
          </div>

          {(item.product.material || item.fitAssessment) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {item.product.material && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Material: {item.product.material}
                </div>
              )}
              {item.fitAssessment && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Fit: {item.fitAssessment}
                </div>
              )}
            </div>
          )}

          {item.product.finishes && item.product.finishes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {item.product.finishes.map((f) => (
                <span key={f} style={{
                  fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                  background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
                }}>
                  {f}
                </span>
              ))}
            </div>
          )}

          {/* Shared notes */}
          {item.sharedNotes && (
            <div style={{
              marginTop: 10, padding: '8px 12px',
              background: 'var(--bg-input)', borderRadius: 8,
              fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
            }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Note</span>
              {item.sharedNotes}
            </div>
          )}

          {/* Client notes */}
          <div style={{ marginTop: 10 }}>
            {editing ? (
              <div>
                <textarea
                  ref={textareaRef}
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value)}
                  placeholder="Add your comment…"
                  rows={3}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    border: '1px solid var(--border-focus)', borderRadius: 8,
                    padding: '8px 10px', fontSize: 13, lineHeight: 1.5,
                    outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                    background: 'var(--bg-card)',
                  }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button
                    onClick={handleNoteSave}
                    disabled={saving}
                    style={{
                      background: '#111111', color: '#fff', border: 'none',
                      borderRadius: 7, padding: '6px 14px', fontSize: 12,
                      fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setNoteValue(item.clientNotes ?? ''); }}
                    style={{
                      background: 'transparent', border: '1px solid var(--border)',
                      borderRadius: 7, padding: '6px 14px', fontSize: 12,
                      fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: 'var(--text-muted)', fontWeight: 600,
                  padding: 0, display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {item.clientNotes ? 'Edit your comment' : 'Add a comment'}
              </button>
            )}
            {!editing && item.clientNotes && (
              <div style={{
                marginTop: 6, padding: '8px 12px',
                background: 'var(--gold-dim)', border: '1px solid var(--gold-border)',
                borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
              }}>
                {item.clientNotes}
              </div>
            )}
          </div>

          {/* Approve / Reject */}
          {item.status !== 'added_to_cart' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => handleStatusChange('approved')}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: isApproved ? 'var(--green)' : 'transparent',
                  color: isApproved ? '#fff' : 'var(--green)',
                  border: `1.5px solid ${isApproved ? 'var(--green)' : 'var(--green-border)'}`,
                }}
              >
                {isApproved ? '✓ Approved' : 'Approve'}
              </button>
              <button
                onClick={() => handleStatusChange('rejected')}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: isRejected ? '#991B1B' : 'transparent',
                  color: isRejected ? '#fff' : '#991B1B',
                  border: `1.5px solid ${isRejected ? '#991B1B' : 'rgba(153,27,27,0.18)'}`,
                }}
              >
                {isRejected ? '✕ Rejected' : 'Reject'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Room section ────────────────────────────────── */

function RoomSection({
  room,
  portalToken,
  onItemUpdate,
}: {
  room: PortalRoom;
  portalToken: string;
  onItemUpdate: (roomId: string, updated: PortalShortlistItem) => void;
}) {
  if (room.shortlistItems.length === 0) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{room.name}</div>
        {room.areaSqft && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
            {Number(room.areaSqft).toFixed(0)} sq.ft
          </div>
        )}
        <div style={{
          marginLeft: 'auto', background: 'var(--bg-input)', border: '1px solid var(--border)',
          borderRadius: 999, padding: '2px 10px', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600,
        }}>
          {room.shortlistItems.length} item{room.shortlistItems.length !== 1 ? 's' : ''}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {room.shortlistItems.map((item) => (
          <ShortlistCard
            key={item.id}
            item={item}
            portalToken={portalToken}
            onUpdate={(updated) => onItemUpdate(room.id, updated)}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Main page ───────────────────────────────────── */

export default function PortalPage() {
  const { portalToken } = useParams<{ portalToken: string }>();
  const [project, setProject] = useState<PortalProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<'shortlist' | 'order'>('shortlist');

  useEffect(() => {
    if (!portalToken) return;
    api.getPortalProject(portalToken).then((r) => {
      if (r.error) { setNotFound(true); }
      else { setProject(r.data!); }
      setLoading(false);
    });
  }, [portalToken]);

  function handleItemUpdate(roomId: string, updated: PortalShortlistItem) {
    if (!project) return;
    setProject({
      ...project,
      rooms: project.rooms.map((room) =>
        room.id === roomId
          ? { ...room, shortlistItems: room.shortlistItems.map((item) => item.id === updated.id ? updated : item) }
          : room
      ),
    });
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 14 }}>
          <svg className="anim-rotate" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading your project…
        </div>
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, background: 'var(--bg-input)',
          border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 20px', color: 'var(--text-muted)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Link not found</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          This portal link is invalid or has been removed.<br />
          Please contact your designer for a new link.
        </div>
      </div>
    );
  }

  const hasOrders = project.orders.length > 0;
  const totalItems = project.rooms.reduce((sum, r) => sum + r.shortlistItems.length, 0);
  const approvedCount = project.rooms.reduce(
    (sum, r) => sum + r.shortlistItems.filter((i) => i.status === 'approved').length, 0
  );
  const rejectedCount = project.rooms.reduce(
    (sum, r) => sum + r.shortlistItems.filter((i) => i.status === 'rejected').length, 0
  );
  const pendingCount = totalItems - approvedCount - rejectedCount;

  return (
    <div>
      {/* Project header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            {project.name}
          </h1>
          {statusBadge(project.status)}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Designed by <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
            {project.designer.businessName || project.designer.fullName}
          </span>
        </div>
      </div>

      {/* Summary row */}
      {totalItems > 0 && (
        <div style={{
          display: 'flex', gap: 12, marginBottom: 24,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '14px 18px',
        }}>
          {[
            { label: 'Items', value: totalItems },
            { label: 'Approved', value: approvedCount },
            { label: 'Pending', value: pendingCount },
            ...(rejectedCount > 0 ? [{ label: 'Rejected', value: rejectedCount }] : []),
          ].map((stat) => (
            <div key={stat.label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 2 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {(['shortlist', 'order'] as const).map((tab) => {
          const label = tab === 'shortlist' ? 'Shortlist' : 'Order Status';
          const isActive = activeTab === tab;
          const isDisabled = tab === 'order' && !hasOrders;
          return (
            <button
              key={tab}
              onClick={() => !isDisabled && setActiveTab(tab)}
              style={{
                background: 'none', border: 'none', cursor: isDisabled ? 'default' : 'pointer',
                padding: '10px 20px', fontSize: 13.5, fontWeight: 700,
                color: isActive ? 'var(--text-primary)' : isDisabled ? 'var(--text-placeholder)' : 'var(--text-muted)',
                borderBottom: `2px solid ${isActive ? 'var(--text-primary)' : 'transparent'}`,
                transition: 'all 0.15s',
              }}
            >
              {label}
              {tab === 'order' && !hasOrders && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: 'var(--text-placeholder)' }}>
                  (not placed yet)
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Shortlist tab */}
      {activeTab === 'shortlist' && (
        <div>
          {totalItems === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 14 }}>
              No items have been shortlisted yet.<br />
              <span style={{ fontSize: 13 }}>Your designer will add items here for your review.</span>
            </div>
          ) : (
            project.rooms.map((room) => (
              <RoomSection
                key={room.id}
                room={room}
                portalToken={portalToken}
                onItemUpdate={handleItemUpdate}
              />
            ))
          )}
        </div>
      )}

      {/* Order Status tab */}
      {activeTab === 'order' && hasOrders && (
        <div>
          {project.orders.map((order) => (
            <div key={order.id} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '20px 22px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Order</div>
                {statusBadge(order.status)}
              </div>
              {order.totalAmount != null && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Total</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>
                    ${Number(order.totalAmount).toLocaleString('en-US')}
                  </div>
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Placed {new Date(order.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <div style={{
                marginTop: 16, padding: '12px 14px',
                background: 'var(--bg-input)', borderRadius: 8,
                fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
              }}>
                Your designer will provide delivery updates. For queries, contact{' '}
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {project.designer.phone || project.designer.email}
                </span>.
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
