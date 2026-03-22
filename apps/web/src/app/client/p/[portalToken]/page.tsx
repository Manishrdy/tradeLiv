'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api, PortalProject, PortalShortlistItem, PortalRoom, PortalProduct } from '@/lib/api';

/* ─── Helpers ─────────────────────────────────────── */

function formatDimensions(dim: PortalProduct['dimensions']): string | null {
  if (!dim || typeof dim !== 'object') return null;
  const d = dim as Record<string, unknown>;
  const parts: string[] = [];
  if (d.width)  parts.push(`W: ${d.width}"`);
  if (d.depth)  parts.push(`D: ${d.depth}"`);
  if (d.height) parts.push(`H: ${d.height}"`);
  if (d.length) parts.push(`L: ${d.length}"`);
  return parts.length > 0 ? parts.join('  ') : null;
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    draft:           { bg: 'var(--bg-input)',      color: 'var(--text-muted)',   label: 'Draft' },
    active:          { bg: 'var(--green-dim)',      color: 'var(--green)',        label: 'Active' },
    ordered:         { bg: 'rgba(56,80,190,0.08)', color: '#3850be',             label: 'Ordered' },
    closed:          { bg: 'var(--bg-input)',       color: 'var(--text-muted)',   label: 'Closed' },
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

/* ─── Comparison Modal ────────────────────────────── */

function ComparisonModal({
  items,
  onClose,
}: {
  items: PortalShortlistItem[];
  onClose: () => void;
}) {
  const dash = '—';

  const specRows: { label: string; get: (item: PortalShortlistItem) => string | React.ReactNode | null }[] = [
    { label: 'Description', get: (i) => (i.product.metadata?.description as string) ?? null },
    { label: 'Category',   get: (i) => i.product.category ?? null },
    { label: 'Style',      get: (i) => (i.product.metadata?.style as string) ?? null },
    { label: 'Material',   get: (i) => i.product.material ?? null },
    { label: 'Dimensions', get: (i) => formatDimensions(i.product.dimensions) },
    { label: 'Finishes',   get: (i) => i.product.finishes?.join(', ') || null },
    {
      label: 'Key Features',
      get: (i) => {
        const features = i.product.metadata?.keyFeatures as string[] | undefined;
        return features?.length
          ? <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6 }}>
              {features.map((f, idx) => <li key={idx}>{f}</li>)}
            </ul>
          : null;
      },
    },
    { label: 'Assembly',   get: (i) => (i.product.metadata?.assembly as string) ?? null },
    { label: 'Lead Time',  get: (i) => i.product.leadTime ?? null },
    { label: 'Care',       get: (i) => (i.product.metadata?.careInstructions as string) ?? null },
    { label: 'Warranty',   get: (i) => (i.product.metadata?.warranty as string) ?? null },
  ];

  const noteRows: { label: string; get: (item: PortalShortlistItem) => string | null }[] = [
    { label: 'Fit Assessment', get: (i) => i.fitAssessment ?? null },
    { label: 'Designer Notes', get: (i) => i.sharedNotes ?? null },
  ];

  const colWidth = `${Math.floor(100 / items.length)}%`;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)', display: 'flex',
        alignItems: 'flex-start', justifyContent: 'center',
        padding: '32px 16px', overflowY: 'auto',
      }}
    >
      <div style={{
        background: 'var(--bg-card)', borderRadius: 16,
        width: '100%', maxWidth: 900,
        boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Compare Products
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 130 }} />
              {items.map((item) => <col key={item.id} style={{ width: colWidth }} />)}
            </colgroup>

            {/* Product header rows */}
            <thead>
              {/* Image row */}
              <tr>
                <td style={{ padding: '16px 16px 0' }} />
                {items.map((item) => (
                  <td key={item.id} style={{ padding: '16px 12px 0', textAlign: 'center', verticalAlign: 'bottom' }}>
                    <div style={{
                      width: '100%', height: 160, borderRadius: 10,
                      background: 'var(--bg-input)', overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid var(--border)',
                    }}>
                      {item.product.imageUrl ? (
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.productName}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="m21 15-5-5L5 21" />
                        </svg>
                      )}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Name row */}
              <tr>
                <td style={{ padding: '12px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Product</td>
                {items.map((item) => (
                  <td key={item.id} style={{ padding: '12px 12px 4px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                      {item.product.productUrl
                        ? <a href={item.product.productUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{item.product.productName}</a>
                        : item.product.productName
                      }
                    </div>
                    {item.product.brandName && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{item.product.brandName}</div>
                    )}
                  </td>
                ))}
              </tr>

              {/* Price row */}
              <tr>
                <td style={{ padding: '4px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Price</td>
                {items.map((item) => (
                  <td key={item.id} style={{ padding: '4px 12px', fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {item.product.price != null ? `$${item.product.price.toLocaleString('en-US')}` : dash}
                    {item.quantity > 1 && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 6 }}>× {item.quantity}</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Status row */}
              <tr>
                <td style={{ padding: '4px 16px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Status</td>
                {items.map((item) => (
                  <td key={item.id} style={{ padding: '4px 12px 12px' }}>
                    {statusBadge(item.status)}
                  </td>
                ))}
              </tr>
            </thead>

            {/* Spec + note rows */}
            <tbody>
              {specRows.map((row) => (
                <tr key={row.label} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    {row.label}
                  </td>
                  {items.map((item) => {
                    const val = row.get(item);
                    return (
                      <td key={item.id} style={{ padding: '10px 12px', fontSize: 12.5, color: val ? 'var(--text-primary)' : 'var(--text-placeholder)', verticalAlign: 'top' }}>
                        {val ?? dash}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {noteRows.map((row, i) => (
                <tr key={row.label} style={{ borderTop: i === 0 ? '2px solid var(--border)' : '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    {row.label}
                  </td>
                  {items.map((item) => {
                    const val = row.get(item);
                    return (
                      <td key={item.id} style={{ padding: '10px 12px', fontSize: 12.5, color: val ? 'var(--text-secondary)' : 'var(--text-placeholder)', verticalAlign: 'top', lineHeight: 1.55 }}>
                        {val ?? dash}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

/* ─── Shortlist item card ─────────────────────────── */

function ShortlistCard({
  item,
  portalToken,
  onUpdate,
  isSelectedForCompare,
  onToggleCompare,
  compareDisabled,
}: {
  item: PortalShortlistItem;
  portalToken: string;
  onUpdate: (updated: PortalShortlistItem) => void;
  isSelectedForCompare: boolean;
  onToggleCompare: () => void;
  compareDisabled: boolean;
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
    if (res.error) { onUpdate(item); setNoteValue(item.clientNotes ?? ''); }
    setEditing(false);
  }

  const isApproved = item.status === 'approved';
  const isRejected = item.status === 'rejected';
  const dimStr     = formatDimensions(item.product.dimensions);

  const cardBorder = isSelectedForCompare
    ? '#3850be'
    : isApproved
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
        <div style={{ width: 120, flexShrink: 0, background: 'var(--bg-input)', position: 'relative', minHeight: 120 }}>
          {item.product.imageUrl ? (
            <img
              src={item.product.imageUrl}
              alt={item.product.productName}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 120 }}
            />
          ) : (
            <div style={{ width: '100%', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
          {/* Name / brand / status */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                {item.product.productUrl
                  ? <a href={item.product.productUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{item.product.productName}</a>
                  : item.product.productName
                }
              </div>
              {item.product.brandName && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.product.brandName}</div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {item.isPinned && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: 'var(--gold)', fontWeight: 700 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  Finalist
                </span>
              )}
              {statusBadge(item.status)}
            </div>
          </div>

          {/* Price + qty */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            {item.product.price != null && (
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                ${item.product.price.toLocaleString('en-US')}
              </div>
            )}
            {item.quantity > 1 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Qty: {item.quantity}</div>
            )}
          </div>

          {/* Specs row */}
          {(item.product.category || item.product.material || dimStr || item.product.leadTime) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
              {item.product.category && (
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Category:</span> {item.product.category}
                </span>
              )}
              {item.product.material && (
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Material:</span> {item.product.material}
                </span>
              )}
              {dimStr && (
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Dim:</span> {dimStr}
                </span>
              )}
              {item.product.leadTime && (
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Lead time:</span> {item.product.leadTime}
                </span>
              )}
            </div>
          )}

          {/* Finishes */}
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

          {/* Fit assessment */}
          {item.fitAssessment && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Fit assessment:</span> {item.fitAssessment}
            </div>
          )}

          {/* Shared notes */}
          {item.sharedNotes && (
            <div style={{
              marginTop: 10, padding: '8px 12px',
              background: 'var(--bg-input)', borderRadius: 8,
              fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
            }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Note from designer</span>
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

          {/* Bottom action row: compare checkbox + approve/reject */}
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>

            {/* Compare checkbox */}
            <button
              onClick={onToggleCompare}
              disabled={compareDisabled}
              title={isSelectedForCompare ? 'Remove from compare' : compareDisabled ? 'Cannot compare (max 4 or different category)' : 'Add to compare'}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: isSelectedForCompare ? 'rgba(56,80,190,0.08)' : 'var(--bg-input)',
                border: `1.5px solid ${isSelectedForCompare ? '#3850be' : 'var(--border)'}`,
                borderRadius: 7, padding: '5px 10px',
                fontSize: 11.5, fontWeight: 600,
                color: isSelectedForCompare ? '#3850be' : 'var(--text-muted)',
                cursor: compareDisabled ? 'not-allowed' : 'pointer',
                opacity: compareDisabled ? 0.35 : 1,
                transition: 'all 0.15s',
              }}
            >
              {/* Mini checkbox circle */}
              <span style={{
                width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${isSelectedForCompare ? '#3850be' : 'var(--border-strong)'}`,
                background: isSelectedForCompare ? '#3850be' : 'transparent',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isSelectedForCompare && (
                  <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              {isSelectedForCompare ? 'Selected' : 'Compare'}
            </button>

            {/* Approve / Reject */}
            {item.status !== 'added_to_cart' && (
              <>
                <button
                  onClick={() => handleStatusChange('approved')}
                  style={{
                    flex: '1 1 70px', padding: '6px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
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
                    flex: '1 1 70px', padding: '6px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: isRejected ? '#991B1B' : 'transparent',
                    color: isRejected ? '#fff' : '#991B1B',
                    border: `1.5px solid ${isRejected ? '#991B1B' : 'rgba(153,27,27,0.18)'}`,
                  }}
                >
                  {isRejected ? '✕ Rejected' : 'Reject'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Room section (with compare state) ──────────── */

function RoomSection({
  room,
  portalToken,
  onItemUpdate,
}: {
  room: PortalRoom;
  portalToken: string;
  onItemUpdate: (roomId: string, updated: PortalShortlistItem) => void;
}) {
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [compareItems, setCompareItems]             = useState<PortalShortlistItem[]>([]);
  const [showCompareModal, setShowCompareModal]     = useState(false);

  if (room.shortlistItems.length === 0) return null;

  // Category of first selected item — all selections must match
  const selectedCategory = room.shortlistItems
    .filter((i) => selectedForCompare.has(i.id))
    .map((i) => i.product.category)
    .find(Boolean) ?? null;

  function handleToggleCompare(itemId: string) {
    const item = room.shortlistItems.find((i) => i.id === itemId);
    if (!item) return;
    setSelectedForCompare((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        if (next.size >= 4) return prev;
        if (selectedCategory && item.product.category && item.product.category !== selectedCategory) return prev;
        next.add(itemId);
      }
      return next;
    });
  }

  function handleMultiCompare() {
    const items = room.shortlistItems.filter((i) => selectedForCompare.has(i.id));
    if (items.length < 2) return;
    setCompareItems(items);
    setShowCompareModal(true);
  }

  function handleCompareFinalists() {
    const finalists = room.shortlistItems.filter((i) => i.isPinned);
    if (finalists.length < 2) return;
    setCompareItems(finalists);
    setShowCompareModal(true);
  }

  const pinnedItems = room.shortlistItems.filter((i) => i.isPinned);

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Room header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
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

      {/* Compare hint + Compare Finalists */}
      {room.shortlistItems.length >= 2 && selectedForCompare.size === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            Tap Compare on 2–4 products to see them side by side.
          </span>
          {pinnedItems.length >= 2 && (
            <button
              onClick={handleCompareFinalists}
              style={{
                background: 'none', border: '1px solid var(--gold)', borderRadius: 7,
                padding: '4px 10px', fontSize: 11.5, fontWeight: 600,
                color: 'var(--gold)', cursor: 'pointer', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 4,
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--gold-rgb, 180,130,20), 0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Compare Finalists ({pinnedItems.length})
            </button>
          )}
        </div>
      )}

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {room.shortlistItems.map((item) => {
          const categoryMismatch = selectedCategory !== null
            && item.product.category != null
            && item.product.category !== selectedCategory;
          const compareDisabled = (!selectedForCompare.has(item.id) && selectedForCompare.size >= 4) || categoryMismatch;
          return (
            <ShortlistCard
              key={item.id}
              item={item}
              portalToken={portalToken}
              onUpdate={(updated) => onItemUpdate(room.id, updated)}
              isSelectedForCompare={selectedForCompare.has(item.id)}
              onToggleCompare={() => handleToggleCompare(item.id)}
              compareDisabled={compareDisabled}
            />
          );
        })}
      </div>

      {/* Compare bar (multi-select mode) */}
      {selectedForCompare.size >= 2 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, display: 'flex', alignItems: 'center', gap: 12,
          background: '#111', borderRadius: 999, padding: '10px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
        }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
            {selectedForCompare.size} selected
          </span>
          <button
            onClick={handleMultiCompare}
            style={{
              background: 'var(--gold)', color: '#fff', border: 'none',
              borderRadius: 999, padding: '7px 18px',
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
            }}
          >
            Compare →
          </button>
          <button
            onClick={() => setSelectedForCompare(new Set())}
            style={{
              background: 'rgba(255,255,255,0.08)', border: 'none',
              borderRadius: 999, padding: '7px 14px',
              fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Comparison modal */}
      {showCompareModal && compareItems.length >= 2 && (
        <ComparisonModal
          items={compareItems}
          onClose={() => { setShowCompareModal(false); setCompareItems([]); }}
        />
      )}
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

  const loadProject = useCallback(() => {
    if (!portalToken) return;
    api.getPortalProject(portalToken).then((r) => {
      if (r.error) { setNotFound(true); }
      else { setProject(r.data!); }
      setLoading(false);
    });
  }, [portalToken]);

  useEffect(() => { loadProject(); }, [loadProject]);

  // ── SSE: real-time sync ────────────────────────────
  useEffect(() => {
    if (!portalToken) return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const es = new EventSource(`${API_URL}/api/portal/${portalToken}/events`);
    es.addEventListener('shortlist_updated', () => { loadProject(); });
    return () => es.close();
  }, [portalToken, loadProject]);

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

  const hasOrders    = project.orders.length > 0;
  const totalItems   = project.rooms.reduce((sum, r) => sum + r.shortlistItems.length, 0);
  const approvedCount = project.rooms.reduce(
    (sum, r) => sum + r.shortlistItems.filter((i) => i.status === 'approved').length, 0
  );
  const rejectedCount = project.rooms.reduce(
    (sum, r) => sum + r.shortlistItems.filter((i) => i.status === 'rejected').length, 0
  );
  const pendingCount = totalItems - approvedCount - rejectedCount;

  return (
    <div style={{ paddingBottom: 100 }}>
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
            { label: 'Items',    value: totalItems },
            { label: 'Approved', value: approvedCount },
            { label: 'Pending',  value: pendingCount },
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
