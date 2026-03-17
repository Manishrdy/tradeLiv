'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, Product, ProductUpdatePayload, ProductDimensions } from '@/lib/api';

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14, marginTop: 28 }}>
      {children}
    </div>
  );
}

function Field({ label, children, optional }: { label: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="form-label">
        {label}
        {optional && (
          <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10.5, opacity: 0.7, marginLeft: 4 }}>(optional)</span>
        )}
      </label>
      {children}
    </div>
  );
}

function formatPrice(price: number | null) {
  if (price == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDimensions(dim?: ProductDimensions | null) {
  if (!dim) return null;
  const parts: string[] = [];
  if (dim.length) parts.push(`${dim.length}L`);
  if (dim.width) parts.push(`${dim.width}W`);
  if (dim.height) parts.push(`${dim.height}H`);
  if (parts.length === 0) return null;
  return parts.join(' × ') + (dim.unit ? ` ${dim.unit}` : '');
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // Edit fields
  const [productName, setProductName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [brandName, setBrandName] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [category, setCategory] = useState('');
  const [material, setMaterial] = useState('');
  const [leadTime, setLeadTime] = useState('');
  const [finishes, setFinishes] = useState<string[]>([]);
  const [finishInput, setFinishInput] = useState('');
  const [dimLength, setDimLength] = useState('');
  const [dimWidth, setDimWidth] = useState('');
  const [dimHeight, setDimHeight] = useState('');
  const [dimUnit, setDimUnit] = useState<'in' | 'cm' | 'ft'>('in');

  useEffect(() => {
    if (!id) return;
    api.getProduct(id).then((r) => {
      if (r.data) { setProduct(r.data); populateForm(r.data); }
      setLoading(false);
    });
  }, [id]);

  function populateForm(p: Product) {
    setProductName(p.productName);
    setSourceUrl(p.sourceUrl);
    setBrandName(p.brandName ?? '');
    setPrice(p.price != null ? String(p.price) : '');
    setImageUrl(p.imageUrl ?? '');
    setProductUrl(p.productUrl ?? '');
    setCategory(p.category ?? '');
    setMaterial(p.material ?? '');
    setLeadTime(p.leadTime ?? '');
    setFinishes(p.finishes ?? []);
    const dim = p.dimensions as ProductDimensions | null;
    setDimLength(dim?.length != null ? String(dim.length) : '');
    setDimWidth(dim?.width != null ? String(dim.width) : '');
    setDimHeight(dim?.height != null ? String(dim.height) : '');
    setDimUnit((dim?.unit as 'in' | 'cm' | 'ft') ?? 'in');
  }

  function addFinish() {
    const val = finishInput.trim();
    if (val && !finishes.includes(val)) setFinishes([...finishes, val]);
    setFinishInput('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim()) { setError('Product name is required.'); return; }
    if (!sourceUrl.trim()) { setError('Source URL is required.'); return; }

    setSaving(true);
    setError('');

    const dimensions = (dimLength || dimWidth || dimHeight)
      ? {
          length: dimLength ? parseFloat(dimLength) : undefined,
          width: dimWidth ? parseFloat(dimWidth) : undefined,
          height: dimHeight ? parseFloat(dimHeight) : undefined,
          unit: dimUnit,
        }
      : null;

    const payload: ProductUpdatePayload = {
      productName: productName.trim(),
      sourceUrl: sourceUrl.trim(),
      brandName: brandName.trim() || null,
      price: price ? parseFloat(price) : null,
      imageUrl: imageUrl.trim() || null,
      productUrl: productUrl.trim() || null,
      category: category.trim() || null,
      material: material.trim() || null,
      leadTime: leadTime.trim() || null,
      finishes,
      dimensions,
    };

    const result = await api.updateProduct(id, payload);
    setSaving(false);

    if (result.error) { setError(result.error); return; }
    const fresh = await api.getProduct(id);
    if (fresh.data) setProduct(fresh.data);
    setEditing(false);
  }

  async function handleToggleActive() {
    setDeactivating(true);
    const result = product?.isActive
      ? await api.deactivateProduct(id)
      : await api.reactivateProduct(id);
    setDeactivating(false);
    setConfirmDeactivate(false);

    if (result.error) { setError(result.error); return; }
    const fresh = await api.getProduct(id);
    if (fresh.data) { setProduct(fresh.data); populateForm(fresh.data); }
  }

  if (loading) {
    return (
      <div style={{ padding: '40px 44px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13.5 }}>
          <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading product…
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ padding: '40px 44px' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 8 }}>Product not found.</div>
        <Link href="/catalog" style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>← Back to catalog</Link>
      </div>
    );
  }

  const dimStr = formatDimensions(product.dimensions as ProductDimensions | null);

  return (
    <div style={{ padding: '40px 44px', maxWidth: 960 }}>

      {/* ── Back ────────────────────────────────────────── */}
      <Link
        href="/catalog"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, textDecoration: 'none', marginBottom: 28 }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to catalog
      </Link>

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
              {product.productName}
            </h1>
            {!product.isActive && (
              <span style={{
                background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 999, padding: '2px 10px', fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600,
              }}>
                Inactive
              </span>
            )}
          </div>
          {product.brandName && (
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{product.brandName}</div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Added {formatDate(product.createdAt)}
          </div>
        </div>

        {!editing && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
            <button
              onClick={() => setConfirmDeactivate(true)}
              style={{
                border: `1px solid ${product.isActive ? 'rgba(180,30,30,0.20)' : 'var(--border)'}`,
                borderRadius: 8, background: 'transparent',
                color: product.isActive ? '#b91c1c' : 'var(--text-secondary)',
                padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.12s',
              }}
            >
              {product.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        )}
      </div>

      {/* ── Confirm deactivate/reactivate dialog ────────── */}
      {confirmDeactivate && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="card" style={{ width: 400, padding: '28px', position: 'relative' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              {product.isActive ? 'Deactivate' : 'Reactivate'} this product?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 22 }}>
              {product.isActive
                ? 'This product will no longer appear in catalog search. Existing shortlist items will remain.'
                : 'This product will be visible in your catalog again.'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setConfirmDeactivate(false)} disabled={deactivating}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleToggleActive}
                disabled={deactivating}
              >
                {deactivating ? 'Processing…' : product.isActive ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18, alignItems: 'start' }}>

        {/* ── Left col ────────────────────────────────────── */}
        <div>
          {editing ? (
            /* Edit mode */
            <div className="card" style={{ padding: 28 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Edit product</div>
              <form onSubmit={handleSave} noValidate>
                <SectionHeading>Product information</SectionHeading>
                <Field label="Product Name *">
                  <input className="input-field" type="text" value={productName} onChange={(e) => setProductName(e.target.value)} />
                </Field>
                <Field label="Source URL *">
                  <input className="input-field" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Brand" optional>
                    <input className="input-field" type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
                  </Field>
                  <Field label="Price" optional>
                    <input className="input-field" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Category" optional>
                    <input className="input-field" type="text" value={category} onChange={(e) => setCategory(e.target.value)} />
                  </Field>
                  <Field label="Material" optional>
                    <input className="input-field" type="text" value={material} onChange={(e) => setMaterial(e.target.value)} />
                  </Field>
                </div>

                <SectionHeading>Media & links</SectionHeading>
                <Field label="Image URL" optional>
                  <input className="input-field" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                </Field>
                <Field label="Product Page URL" optional>
                  <input className="input-field" type="url" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} />
                </Field>

                <SectionHeading>Dimensions</SectionHeading>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 90px', gap: 12 }}>
                  <Field label="Length"><input className="input-field" type="number" min="0" step="0.1" value={dimLength} onChange={(e) => setDimLength(e.target.value)} /></Field>
                  <Field label="Width"><input className="input-field" type="number" min="0" step="0.1" value={dimWidth} onChange={(e) => setDimWidth(e.target.value)} /></Field>
                  <Field label="Height"><input className="input-field" type="number" min="0" step="0.1" value={dimHeight} onChange={(e) => setDimHeight(e.target.value)} /></Field>
                  <Field label="Unit">
                    <select className="select-field" value={dimUnit} onChange={(e) => setDimUnit(e.target.value as 'in' | 'cm' | 'ft')}>
                      <option value="in">in</option><option value="cm">cm</option><option value="ft">ft</option>
                    </select>
                  </Field>
                </div>

                <SectionHeading>Finishes</SectionHeading>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input
                    className="input-field"
                    type="text"
                    placeholder="Add a finish…"
                    value={finishInput}
                    onChange={(e) => setFinishInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFinish(); } }}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn-ghost" onClick={addFinish} style={{ flexShrink: 0, fontSize: 12 }}>Add</button>
                </div>
                {finishes.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                    {finishes.map((f) => (
                      <span key={f} className="tag-chip" style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }} onClick={() => setFinishes(finishes.filter((x) => x !== f))}>
                        {f}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </span>
                    ))}
                  </div>
                )}

                <Field label="Lead Time" optional>
                  <input className="input-field" type="text" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} />
                </Field>

                {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

                <div style={{ display: 'flex', gap: 10, marginTop: 22, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? (
                      <><svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>Saving…</>
                    ) : 'Save changes'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => { setEditing(false); setError(''); if (product) populateForm(product); }}>Cancel</button>
                </div>
              </form>
            </div>
          ) : (
            /* View mode */
            <div className="card" style={{ padding: 28 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Product details</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {[
                  { label: 'Price', value: formatPrice(product.price) },
                  { label: 'Category', value: product.category || '—' },
                  { label: 'Material', value: product.material || '—' },
                  { label: 'Lead time', value: product.leadTime || '—' },
                  { label: 'Dimensions', value: dimStr || '—' },
                  { label: 'Shortlisted', value: `${product._count?.shortlistItems ?? 0} time${(product._count?.shortlistItems ?? 0) !== 1 ? 's' : ''}` },
                ].map((row) => (
                  <div key={row.label}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{row.label}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{row.value}</div>
                  </div>
                ))}
              </div>

              {/* Finishes */}
              {product.finishes.length > 0 && (
                <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Finishes</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {product.finishes.map((f) => (
                      <span key={f} className="tag-chip">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Source URL */}
              <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Source URL</div>
                <a
                  href={product.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 500, wordBreak: 'break-all' }}
                >
                  {product.sourceUrl}
                </a>
              </div>

              {product.productUrl && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Product page</div>
                  <a
                    href={product.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 500, wordBreak: 'break-all' }}
                  >
                    {product.productUrl}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right col — Image + quick info ───────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Image card */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{
              width: '100%', height: 240,
              background: 'var(--bg-input)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.productName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <div style={{ fontSize: 11, marginTop: 6 }}>No image</div>
                </div>
              )}
            </div>
          </div>

          {/* Quick stats card */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Quick info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Status</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 999,
                  background: product.isActive ? 'var(--green-dim)' : 'rgba(0,0,0,0.04)',
                  border: `1px solid ${product.isActive ? 'var(--green-border)' : 'rgba(0,0,0,0.09)'}`,
                  color: product.isActive ? 'var(--green)' : 'var(--text-muted)',
                }}>
                  {product.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>In shortlists</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{product._count?.shortlistItems ?? 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>In carts</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{product._count?.cartItems ?? 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Added</span>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>{formatDate(product.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
