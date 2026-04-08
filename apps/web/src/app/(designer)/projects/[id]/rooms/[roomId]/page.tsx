'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, Room, ShortlistItem, ProductListItem, ShortlistUpdatePayload } from '@/lib/api';

/* ─── Helpers ───────────────────────────────────────── */

function formatBudget(min: number | null, max: number | null) {
  if (!min && !max) return null;
  const fmt = (v: number) => {
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1).replace('.0', '')}M`;
    if (v >= 1000)    return `$${(v / 1000).toFixed(0)}K`;
    return `$${v}`;
  };
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

function formatPrice(price: number | null) {
  if (price == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price);
}

function formatDimensions(dim: any): string | null {
  if (!dim) return null;
  const parts: string[] = [];
  if (dim.length != null) parts.push(`${dim.length}L`);
  if (dim.width != null)  parts.push(`${dim.width}W`);
  if (dim.height != null) parts.push(`${dim.height}H`);
  if (parts.length === 0) return null;
  return parts.join(' × ') + (dim.unit ? ` ${dim.unit}` : '');
}

const STATUS_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  suggested:     { bg: 'rgba(0,0,0,0.04)',     border: 'rgba(0,0,0,0.09)',     color: 'var(--text-muted)',   label: 'Suggested' },
  approved:      { bg: 'var(--green-dim)',      border: 'var(--green-border)',   color: 'var(--green)',        label: 'Approved' },
  rejected:      { bg: 'rgba(180,30,30,0.07)', border: 'rgba(180,30,30,0.18)', color: '#b91c1c',             label: 'Rejected' },
  added_to_cart: { bg: 'rgba(50,80,190,0.07)', border: 'rgba(50,80,190,0.18)', color: '#3850be',             label: 'In Cart' },
  ordered:       { bg: 'rgba(22,101,52,0.07)', border: 'rgba(22,101,52,0.18)', color: '#166534',             label: 'Ordered' },
};

/* ─── Comparison Modal ──────────────────────────────── */

function ComparisonModal({
  items,
  onClose,
}: {
  items: ShortlistItem[];
  onClose: () => void;
}) {
  const dash = <span style={{ color: 'var(--text-placeholder)' }}>—</span>;

  const specRows: { label: string; render: (item: ShortlistItem) => React.ReactNode; isNote?: boolean }[] = [
    {
      label: 'Description',
      render: (i) => i.product.metadata?.description
        ? <span style={{ fontSize: 12, lineHeight: 1.5 }}>{i.product.metadata.description as string}</span>
        : dash,
    },
    { label: 'Category',       render: (i) => i.product.category  || dash },
    { label: 'Style',          render: (i) => (i.product.metadata?.style as string) || dash },
    { label: 'Material',       render: (i) => i.product.material  || dash },
    { label: 'Dimensions',     render: (i) => formatDimensions(i.product.dimensions) || dash },
    {
      label: 'Finishes',
      render: (i) => {
        const availableColors = i.product.metadata?.availableColors as string[] | undefined;
        const fins = i.product.finishes?.length
          ? i.product.finishes
          : availableColors?.length
            ? availableColors
            : null;
        return fins
          ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {fins.map((f) => (
                <span key={f} className="tag-chip" style={{ fontSize: 11 }}>{f}</span>
              ))}
            </div>
          : dash;
      },
    },
    {
      label: 'Colors',
      render: (i) => {
        const colors = i.product.metadata?.availableColors as string[] | undefined;
        return colors?.length
          ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {colors.map((c) => (
                <span key={c} className="tag-chip" style={{ fontSize: 11 }}>{c}</span>
              ))}
            </div>
          : dash;
      },
    },
    {
      label: 'Sizes',
      render: (i) => {
        const sizes = i.product.metadata?.availableSizes as string[] | undefined;
        return sizes?.length
          ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {sizes.map((s) => (
                <span key={s} className="tag-chip" style={{ fontSize: 11 }}>{s}</span>
              ))}
            </div>
          : dash;
      },
    },
    {
      label: 'Key Features',
      render: (i) => {
        const features = i.product.metadata?.keyFeatures as string[] | undefined;
        const filtered = features?.filter(f => !/\bavailable in\b/i.test(f));
        return filtered?.length
          ? <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6 }}>
              {filtered.map((f, idx) => <li key={idx}>{f}</li>)}
            </ul>
          : dash;
      },
    },
    { label: 'Assembly',       render: (i) => (i.product.metadata?.assembly as string) || dash },
    { label: 'Lead Time',      render: (i) => i.product.leadTime  || dash },
    { label: 'Care',           render: (i) => (i.product.metadata?.careInstructions as string) || dash },
    { label: 'Warranty',       render: (i) => (i.product.metadata?.warranty as string) || dash },
    {
      label: 'Source',
      render: (i) => i.product.productUrl
        ? <a href={i.product.productUrl} target="_blank" rel="noopener noreferrer"
             style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'underline' }}>
            View product page
          </a>
        : dash,
    },
    { label: 'Fit Assessment', render: (i) => i.fitAssessment     || dash, isNote: true },
    { label: 'Shared Notes',   render: (i) => i.sharedNotes       || dash, isNote: true },
    { label: 'Designer Notes', render: (i) => i.designerNotes     || dash, isNote: true },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 14,
        width: '100%', maxWidth: Math.min(300 * items.length + 140, 1100),
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>

        {/* Header */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Comparing {items.length} product{items.length !== 1 ? 's' : ''}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable table */}
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 130, minWidth: 130 }} />
              {items.map((item) => <col key={item.id} />)}
            </colgroup>
            <thead>
              <tr>
                <th style={{
                  padding: '20px 16px', background: 'var(--bg-input)',
                  borderRight: '1px solid var(--border)', verticalAlign: 'bottom', textAlign: 'left',
                }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Product
                  </span>
                </th>
                {items.map((item) => (
                  <th key={item.id} style={{
                    padding: '20px 16px', verticalAlign: 'top',
                    borderLeft: '1px solid var(--border)', textAlign: 'left', fontWeight: 400,
                  }}>
                    {/* Image */}
                    <div style={{
                      width: '100%', height: 160, borderRadius: 10, overflow: 'hidden',
                      background: 'var(--bg-input)', marginBottom: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {item.product.imageUrl ? (
                        <img
                          src={item.product.imageUrl} alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4">
                          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                        </svg>
                      )}
                    </div>

                    {/* Name, brand, price, badges */}
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2, lineHeight: 1.3 }}>
                      {item.product.productName}
                    </div>
                    {item.product.brandName && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{item.product.brandName}</div>
                    )}
                    <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 8 }}>
                      {item.product.price != null ? formatPrice(item.product.price) : '—'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        background: STATUS_STYLES[item.status]?.bg,
                        border: `1px solid ${STATUS_STYLES[item.status]?.border}`,
                        color: STATUS_STYLES[item.status]?.color,
                        borderRadius: 999, padding: '2px 9px', fontSize: 10.5, fontWeight: 600,
                      }}>
                        {STATUS_STYLES[item.status]?.label}
                      </span>
                      {item.isPinned && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: 'var(--gold)', fontWeight: 700 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          Finalist
                        </span>
                      )}
                    </div>
                    {item.quantity > 1 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Qty: {item.quantity}</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {specRows.map((row, i) => {
                const isFirstNote = row.isNote && !specRows[i - 1]?.isNote;
                return (
                  <tr key={row.label} style={{ borderTop: `${isFirstNote ? '2px' : '1px'} solid var(--border)` }}>
                    <td style={{
                      padding: '11px 16px', fontSize: 10.5, fontWeight: 700,
                      color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
                      verticalAlign: 'top', background: 'var(--bg-input)',
                      borderRight: '1px solid var(--border)', whiteSpace: 'nowrap',
                    }}>
                      {row.label}
                    </td>
                    {items.map((item) => (
                      <td key={item.id} style={{
                        padding: '11px 16px', fontSize: 13, color: 'var(--text-primary)',
                        verticalAlign: 'top', borderLeft: '1px solid var(--border)', lineHeight: 1.55,
                      }}>
                        {row.render(item)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add from Catalog Modal ────────────────────────── */

function AddFromCatalogModal({
  projectId,
  roomId,
  onAdded,
  onClose,
}: {
  projectId: string;
  roomId: string;
  onAdded: () => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ProductListItem | null>(null);

  const [quantity, setQuantity] = useState(1);
  const [designerNotes, setDesignerNotes] = useState('');
  const [sharedNotes, setSharedNotes] = useState('');
  const [fitAssessment, setFitAssessment] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.getProducts({ search: search.trim() || undefined, limit: 12 }).then((r) => {
      if (r.data) setProducts(r.data.products);
      setLoading(false);
    });
  }, [search]);

  async function handleAdd() {
    if (!selectedProduct) return;
    setAdding(true);
    setError('');
    const result = await api.addToShortlist(projectId, {
      productId: selectedProduct.id,
      roomId,
      quantity,
      designerNotes: designerNotes.trim() || undefined,
      sharedNotes: sharedNotes.trim() || undefined,
      fitAssessment: fitAssessment.trim() || undefined,
    });
    setAdding(false);
    if (result.error) { setError(result.error); return; }
    onAdded();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div className="card" style={{ width: 580, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {selectedProduct ? 'Add to Shortlist' : 'Choose a Product'}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          {!selectedProduct && (
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="input-field" type="text" placeholder="Search your catalog…"
                value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 32, width: '100%' }} autoFocus
              />
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px 24px' }}>
          {selectedProduct ? (
            <div>
              {/* Selected product preview */}
              <div style={{
                display: 'flex', gap: 14, padding: '12px 14px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--bg-input)', marginBottom: 20,
              }}>
                <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selectedProduct.imageUrl ? (
                    <img src={selectedProduct.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedProduct.productName}</div>
                  {selectedProduct.brandName && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedProduct.brandName}</div>}
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{formatPrice(selectedProduct.price)}</div>
                </div>
                <button onClick={() => setSelectedProduct(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, alignSelf: 'flex-start' }} title="Change product">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Quantity</label>
                <input className="input-field" type="number" min="1" value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} style={{ width: 100 }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">
                  Designer Notes
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10.5, opacity: 0.7, marginLeft: 4 }}>(internal, not visible to client)</span>
                </label>
                <textarea className="input-field" value={designerNotes} onChange={(e) => setDesignerNotes(e.target.value)} rows={2} placeholder="Internal notes for your reference…" style={{ resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">
                  Shared Notes
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10.5, opacity: 0.7, marginLeft: 4 }}>(visible to client)</span>
                </label>
                <textarea className="input-field" value={sharedNotes} onChange={(e) => setSharedNotes(e.target.value)} rows={2} placeholder="Notes visible to your client…" style={{ resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Fit Assessment</label>
                <input className="input-field" type="text" value={fitAssessment} onChange={(e) => setFitAssessment(e.target.value)} placeholder="e.g. Fits room dimensions well" />
              </div>

              {error && <div className="error-box" style={{ marginBottom: 14 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <button className="btn-primary" onClick={handleAdd} disabled={adding} style={{ flex: 1 }}>
                  {adding ? (
                    <>
                      <svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
                      Adding…
                    </>
                  ) : 'Add to Shortlist'}
                </button>
                <button className="btn-ghost" onClick={onClose}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13, padding: '24px 0' }}>
                  <svg className="anim-rotate" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
                  Searching catalog…
                </div>
              ) : products.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13.5 }}>
                  {search ? 'No products match your search.' : 'No products in your catalog yet.'}
                  <br />
                  <Link href="/catalog/new" style={{ color: 'var(--gold)', fontWeight: 600, fontSize: 13 }}>Add a product →</Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {products.map((p) => (
                    <div
                      key={p.id} onClick={() => setSelectedProduct(p)}
                      style={{ display: 'flex', gap: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.12s' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'; (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-input)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.background = ''; }}
                    >
                      <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4">
                            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.productName}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{p.brandName || p.category || ''}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0, alignSelf: 'center' }}>
                        {formatPrice(p.price)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Shortlist Item Card ───────────────────────────── */

function ShortlistItemCard({
  item,
  projectId,
  onItemChange,
  onItemRemove,
  isSelectedForCompare,
  onToggleCompare,
  compareDisabled,
}: {
  item: ShortlistItem;
  projectId: string;
  onItemChange: (id: string, updated: Partial<ShortlistItem>) => void;
  onItemRemove: (id: string) => void;
  isSelectedForCompare: boolean;
  onToggleCompare: () => void;
  compareDisabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [quantity, setQuantity] = useState(item.quantity);
  const [designerNotes, setDesignerNotes] = useState(item.designerNotes ?? '');
  const [sharedNotes, setSharedNotes] = useState(item.sharedNotes ?? '');
  const [fitAssessment, setFitAssessment] = useState(item.fitAssessment ?? '');
  const [isPinned, setIsPinned] = useState(item.isPinned);

  const st = STATUS_STYLES[item.status] ?? STATUS_STYLES.suggested;
  const isOrdered = item.status === 'ordered';

  // Card border: blue when selected for compare, gold when pinned finalist, else default
  const cardBorder = isSelectedForCompare ? '#3850be' : item.isPinned ? 'var(--gold)' : 'var(--border)';

  async function handleSave() {
    setSaving(true);
    const payload: ShortlistUpdatePayload = {
      quantity,
      designerNotes: designerNotes.trim() || null,
      sharedNotes: sharedNotes.trim() || null,
      fitAssessment: fitAssessment.trim() || null,
      isPinned,
    };
    // Optimistic update
    onItemChange(item.id, {
      quantity,
      designerNotes: designerNotes.trim() || null,
      sharedNotes: sharedNotes.trim() || null,
      fitAssessment: fitAssessment.trim() || null,
      isPinned,
      status: isPinned ? 'added_to_cart' : 'suggested',
    });
    setEditing(false);
    setSaving(false);
    await api.updateShortlistItem(projectId, item.id, payload);
  }

  async function handleRemove() {
    setRemoving(true);
    // Optimistic remove
    onItemRemove(item.id);
    await api.removeShortlistItem(projectId, item.id);
  }

  async function handleTogglePin() {
    const newPinned = !item.isPinned;
    // Optimistic update — instant UI change
    onItemChange(item.id, {
      isPinned: newPinned,
      status: newPinned ? 'added_to_cart' : 'suggested',
    });
    await api.updateShortlistItem(projectId, item.id, { isPinned: newPinned });
  }

  return (
    <div style={{
      border: `1px solid ${cardBorder}`,
      borderRadius: 12, overflow: 'hidden',
      background: 'var(--bg-card)',
      transition: 'border-color 0.15s',
    }}>
      <div style={{ display: 'flex', gap: 14, padding: '14px 16px' }}>
        {/* Image */}
        <Link href={`/catalog/${item.product.id}`} style={{ flexShrink: 0 }}>
          <div style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {item.product.imageUrl ? (
              <img src={item.product.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
              </svg>
            )}
          </div>
        </Link>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <Link href={`/catalog/${item.product.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.product.productName}
                </div>
              </Link>
              {item.product.brandName && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{item.product.brandName}</div>
              )}
            </div>
            <div style={{ background: st.bg, border: `1px solid ${st.border}`, borderRadius: 999, padding: '2px 9px', fontSize: 10.5, color: st.color, fontWeight: 600, flexShrink: 0 }}>
              {st.label}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{formatPrice(item.product.price)}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Qty: {item.quantity}</span>
            {item.product.category && <span className="tag-chip">{item.product.category}</span>}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, alignItems: 'center' }}>
          {/* Compare checkbox */}
          <button
            onClick={onToggleCompare}
            disabled={compareDisabled}
            title={isSelectedForCompare ? 'Remove from compare' : compareDisabled ? 'Cannot compare (max 4 or different category)' : 'Add to compare'}
            style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${isSelectedForCompare ? '#3850be' : 'var(--border-strong)'}`,
              background: isSelectedForCompare ? '#3850be' : 'var(--bg-card)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: compareDisabled ? 'not-allowed' : 'pointer',
              opacity: compareDisabled ? 0.3 : 1,
              transition: 'all 0.15s',
              padding: 0,
            }}
          >
            {isSelectedForCompare && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>

          {/* Pin (finalist) */}
          <button onClick={handleTogglePin} disabled={isOrdered} title={isOrdered ? 'Ordered — locked' : item.isPinned ? 'Unpin finalist' : 'Pin as finalist'}
            style={{ background: 'none', border: 'none', cursor: isOrdered ? 'not-allowed' : 'pointer', padding: 4, color: item.isPinned ? 'var(--gold)' : 'var(--text-muted)', transition: 'color 0.12s', opacity: isOrdered ? 0.4 : 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill={item.isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>

          {/* Edit */}
          <button onClick={() => !isOrdered && setEditing(!editing)} disabled={isOrdered} title={isOrdered ? 'Ordered — locked' : 'Edit'}
            style={{ background: 'none', border: 'none', cursor: isOrdered ? 'not-allowed' : 'pointer', padding: 4, color: 'var(--text-muted)', opacity: isOrdered ? 0.4 : 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>

          {/* Delete */}
          <button onClick={() => !isOrdered && setConfirmRemove(true)} disabled={isOrdered} title={isOrdered ? 'Ordered — locked' : 'Remove'}
            style={{ background: 'none', border: 'none', cursor: isOrdered ? 'not-allowed' : 'pointer', padding: 4, color: 'var(--text-muted)', opacity: isOrdered ? 0.4 : 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Notes row */}
      {(item.designerNotes || item.sharedNotes || item.fitAssessment || item.clientNotes) && !editing && (
        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {item.fitAssessment && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fit: </span>
              {item.fitAssessment}
            </div>
          )}
          {item.designerNotes && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes: </span>
              {item.designerNotes}
            </div>
          )}
          {item.sharedNotes && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Shared: </span>
              {item.sharedNotes}
            </div>
          )}
          {item.clientNotes && (
            <div style={{ fontSize: 12, color: 'var(--gold)' }}>
              <span style={{ fontWeight: 600, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Client: </span>
              {item.clientNotes}
            </div>
          )}
        </div>
      )}

      {/* Inline edit form */}
      {editing && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 10, marginTop: 14 }}>
            <div>
              <label className="form-label">Qty</label>
              <input className="input-field" type="number" min="1" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
            <div>
              <label className="form-label">Fit Assessment</label>
              <input className="input-field" type="text" value={fitAssessment} onChange={(e) => setFitAssessment(e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label className="form-label">Designer Notes <span style={{ fontWeight: 400, fontSize: 10, opacity: 0.6 }}>(internal)</span></label>
            <textarea className="input-field" value={designerNotes} onChange={(e) => setDesignerNotes(e.target.value)} rows={2} style={{ resize: 'vertical' }} />
          </div>
          <div style={{ marginTop: 10 }}>
            <label className="form-label">Shared Notes <span style={{ fontWeight: 400, fontSize: 10, opacity: 0.6 }}>(visible to client)</span></label>
            <textarea className="input-field" value={sharedNotes} onChange={(e) => setSharedNotes(e.target.value)} rows={2} style={{ resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: 12, padding: '6px 16px' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn-ghost" onClick={() => { setEditing(false); setQuantity(item.quantity); setDesignerNotes(item.designerNotes ?? ''); setSharedNotes(item.sharedNotes ?? ''); setFitAssessment(item.fitAssessment ?? ''); }} style={{ fontSize: 12 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Confirm remove dialog */}
      {confirmRemove && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 380, padding: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Remove from shortlist?</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
              &ldquo;{item.product.productName}&rdquo; will be removed from this room&apos;s shortlist.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setConfirmRemove(false)} disabled={removing}>Cancel</button>
              <button onClick={handleRemove} disabled={removing}
                style={{ border: 'none', borderRadius: 8, background: '#b91c1c', color: '#fff', padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: removing ? 0.7 : 1 }}>
                {removing ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Room PDF Button ──────────────────────────────── */

function RoomPdfButton({ projectId, roomId }: { projectId: string; roomId: string }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    const result = await api.downloadRoomPdf(projectId, roomId);
    setDownloading(false);
    if (result.error) { alert(result.error); return; }
    if (result.data) {
      const url = URL.createObjectURL(result.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Room_Spec_Sheet.pdf';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
        border: '1px solid var(--border)', background: 'var(--bg-card)',
        color: 'var(--text-secondary)', borderRadius: 999, padding: '5px 14px',
        fontSize: 11.5, fontWeight: 700, cursor: downloading ? 'wait' : 'pointer',
        fontFamily: 'inherit', transition: 'all 0.15s', opacity: downloading ? 0.6 : 1,
      }}
      title="Download room spec sheet as PDF"
    >
      {downloading ? (
        <svg className="anim-rotate" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
      )}
      Spec Sheet
    </button>
  );
}

/* ─── Main Page ─────────────────────────────────────── */

export default function RoomDetailPage() {
  const { id: projectId, roomId } = useParams<{ id: string; roomId: string }>();
  const router = useRouter();

  const [room, setRoom]               = useState<Room | null>(null);
  const [loading, setLoading]         = useState(true);
  const [notFound, setNotFound]       = useState(false);
  const [shortlistItems, setShortlistItems] = useState<ShortlistItem[]>([]);
  const [shortlistLoading, setShortlistLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Compare state
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [compareItems, setCompareItems]             = useState<ShortlistItem[]>([]);
  const [showCompareModal, setShowCompareModal]     = useState(false);

  useEffect(() => {
    api.getProject(projectId).then((r) => {
      if (r.error || !r.data) { setNotFound(true); setLoading(false); return; }
      const found = r.data.rooms.find((rm) => rm.id === roomId);
      if (!found) { setNotFound(true); setLoading(false); return; }
      setRoom(found);
      setLoading(false);
    });
  }, [projectId, roomId]);

  const loadShortlist = useCallback(() => {
    setShortlistLoading(true);
    api.getProjectShortlist(projectId, roomId).then((r) => {
      if (r.data) setShortlistItems(r.data);
      setShortlistLoading(false);
    });
  }, [projectId, roomId]);

  useEffect(() => { loadShortlist(); }, [loadShortlist]);

  // ── SSE: real-time sync ────────────────────────────
  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const es = new EventSource(`${API_URL}/api/projects/${projectId}/events`, { withCredentials: true });
    es.addEventListener('shortlist_updated', () => { loadShortlist(); });
    return () => es.close();
  }, [projectId, loadShortlist]);

  // ── Compare handlers ────────────────────────────────

  // Category of the first selected item (all selected items must match)
  const selectedCategory = shortlistItems
    .filter((i) => selectedForCompare.has(i.id))
    .map((i) => i.product.category)
    .find(Boolean) ?? null;

  function toggleSelectForCompare(id: string) {
    const item = shortlistItems.find((i) => i.id === id);
    if (!item) return;
    setSelectedForCompare((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 4) return prev;
        // Enforce same-category
        if (selectedCategory && item.product.category && item.product.category !== selectedCategory) return prev;
        next.add(id);
      }
      return next;
    });
  }

  function handleMultiCompare() {
    const selected = shortlistItems.filter((i) => selectedForCompare.has(i.id));
    if (selected.length < 2) return;
    setCompareItems(selected);
    setShowCompareModal(true);
  }

  function handleCompareFinalists() {
    const finalists = shortlistItems.filter((i) => i.isPinned);
    if (finalists.length < 2) return;
    setCompareItems(finalists);
    setShowCompareModal(true);
  }

  function clearCompareModal() {
    setShowCompareModal(false);
    setCompareItems([]);
    setSelectedForCompare(new Set());
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 44px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13.5 }}>
        <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
        Loading room…
      </div>
    );
  }

  if (notFound || !room) {
    return (
      <div style={{ padding: '60px 44px', textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Room not found</div>
        <button className="btn-ghost" onClick={() => router.push(`/projects/${projectId}/rooms`)} style={{ fontSize: 13 }}>
          ← Back to Rooms
        </button>
      </div>
    );
  }

  const budget  = formatBudget(room.budgetMin, room.budgetMax);
  const hasDims = room.lengthFt != null || room.widthFt != null || room.heightFt != null;
  const req     = room.clientRequirements;

  const pinnedItems   = shortlistItems.filter((i) => i.isPinned);
  const unpinnedItems = shortlistItems.filter((i) => !i.isPinned);
  const sortedItems   = [...pinnedItems, ...unpinnedItems];

  const statusCounts = shortlistItems.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ padding: '40px 44px 120px', maxWidth: 760 }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 20 }}>
        <Link href={`/projects/${projectId}/rooms`} style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>
          ← Rooms
        </Link>
        <span style={{ color: 'var(--border-strong)' }}>/</span>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{room.name}</span>
      </div>

      {/* Room header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em', margin: '0 0 6px' }}>
            {room.name}
          </h1>
          <RoomPdfButton projectId={projectId} roomId={roomId} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
          {room.areaSqft != null && <span>{room.areaSqft} sq ft</span>}
          {hasDims && <span>{[room.lengthFt, room.widthFt, room.heightFt].filter(Boolean).join(' × ')} ft</span>}
          {budget && <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{budget}</span>}
        </div>
      </div>

      {/* Furniture Needed */}
      {room.categoryNeeds.length > 0 && (
        <div className="card" style={{ padding: '20px 22px', marginBottom: 16 }}>
          <SectionTitle>Furniture Needed</SectionTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {room.categoryNeeds.map((cat) => (
              <span key={cat} style={{ border: '1px solid #111', background: '#111', color: '#fff', borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Client Requirements */}
      {req && (
        <div className="card" style={{ padding: '20px 22px', marginBottom: 16 }}>
          <SectionTitle>Client Requirements</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {req.colorPalette && <DetailRow label="Color palette" value={req.colorPalette} />}
            {req.materialPreferences && <DetailRow label="Material preferences" value={req.materialPreferences} />}
            {req.seatingCapacity != null && <DetailRow label="Seating capacity" value={`${req.seatingCapacity} persons`} />}
            {req.functionalConstraints && <DetailRow label="Functional constraints" value={req.functionalConstraints} />}
            {req.inspirationLinks?.length ? (
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Inspiration links</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {req.inspirationLinks.map((link, i) => (
                    <a key={i} href={link} target="_blank" rel="noreferrer"
                      style={{ fontSize: 13, color: '#a8710a', textDecoration: 'none', fontWeight: 500, wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      {link.length > 60 ? link.slice(0, 60) + '…' : link}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Designer Notes */}
      {room.notes && (
        <div className="card" style={{ padding: '20px 22px', marginBottom: 16 }}>
          <SectionTitle>Designer Notes</SectionTitle>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{room.notes}</p>
        </div>
      )}

      {/* ── Shortlist Section ───────────────────────────── */}
      <div className="card" style={{ padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SectionTitle style={{ margin: 0 }}>Shortlist</SectionTitle>
            {shortlistItems.length > 0 && (
              <span style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 999, padding: '2px 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                {shortlistItems.length}
              </span>
            )}
          </div>
          <button className="btn-primary" onClick={() => setShowAddModal(true)} style={{ fontSize: 12, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add from Catalog
          </button>
        </div>

        {/* Status summary */}
        {shortlistItems.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {Object.entries(statusCounts).map(([status, count]) => {
              const s = STATUS_STYLES[status] ?? STATUS_STYLES.suggested;
              return (
                <span key={status} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 999, padding: '3px 10px', fontSize: 11, color: s.color, fontWeight: 600 }}>
                  {count} {s.label}
                </span>
              );
            })}
          </div>
        )}

        {/* Compare hint + Compare Finalists */}
        {shortlistItems.length >= 2 && selectedForCompare.size === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              Tick the circle on 2–4 products to compare them side by side.
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

        {shortlistLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
            <svg className="anim-rotate" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
            Loading shortlist…
          </div>
        ) : shortlistItems.length === 0 ? (
          <div style={{ border: '1.5px dashed var(--border-strong)', borderRadius: 10, padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 10, opacity: 0.4 }}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>No items shortlisted yet</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Click &ldquo;Add from Catalog&rdquo; to shortlist products for this room.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedItems.map((item) => {
              const categoryMismatch = selectedCategory !== null
                && item.product.category != null
                && item.product.category !== selectedCategory;
              const compareDisabled = (!selectedForCompare.has(item.id) && selectedForCompare.size >= 4) || categoryMismatch;
              return (
                <ShortlistItemCard
                  key={item.id}
                  item={item}
                  projectId={projectId}
                  onItemChange={(id, updated) => {
                    setShortlistItems((prev) => prev.map((i) => i.id === id ? { ...i, ...updated } : i));
                  }}
                  onItemRemove={(id) => {
                    setShortlistItems((prev) => prev.filter((i) => i.id !== id));
                  }}
                  isSelectedForCompare={selectedForCompare.has(item.id)}
                  onToggleCompare={() => toggleSelectForCompare(item.id)}
                  compareDisabled={compareDisabled}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Add from catalog modal */}
      {showAddModal && (
        <AddFromCatalogModal
          projectId={projectId}
          roomId={roomId}
          onAdded={() => { setShowAddModal(false); loadShortlist(); }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Comparison modal */}
      {showCompareModal && compareItems.length >= 2 && (
        <ComparisonModal items={compareItems} onClose={clearCompareModal} />
      )}

      {/* ── Fixed compare bar (multi-select mode) ─────── */}
      {selectedForCompare.size >= 2 && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, background: '#111', color: '#fff',
          borderRadius: 14, padding: '12px 20px',
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {selectedForCompare.size} product{selectedForCompare.size !== 1 ? 's' : ''} selected
            {selectedForCompare.size === 4 && <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 6 }}>(max)</span>}
          </span>
          <button
            onClick={handleMultiCompare}
            style={{ background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Compare →
          </button>
          <button
            onClick={() => setSelectedForCompare(new Set())}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 500, padding: 0 }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Shared Components ─────────────────────────────── */

function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, ...style }}>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
    </div>
  );
}
