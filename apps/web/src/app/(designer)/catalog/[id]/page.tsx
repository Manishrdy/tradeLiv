'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, Product, ProductUpdatePayload, ProductDimensions, ProductMetadata, ExtractedProduct } from '@/lib/api';

const EXTRACT_STEPS = [
  'Visiting page…',
  'Reading product details…',
  'Identifying product data…',
  'Almost done…',
];

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

/* ─── Metadata labels & display ──────────────────────── */

const METADATA_LABELS: Record<string, string> = {
  description: 'Description',
  keyFeatures: 'Key Features',
  assembly: 'Assembly',
  careInstructions: 'Care Instructions',
  warranty: 'Warranty',
  weightCapacity: 'Weight Capacity',
  style: 'Style',
  collection: 'Collection',
  sku: 'SKU',
  availableColors: 'Available Colors',
  availableSizes: 'Available Sizes',
  seatHeight: 'Seat Height',
  armHeight: 'Arm Height',
  seatDepth: 'Seat Depth',
  legMaterial: 'Leg Material',
  cushionType: 'Cushion Type',
  fabricType: 'Fabric Type',
};

// Fields that are shown inline in the product detail grid — skip in the accordion
const INLINE_METADATA_KEYS = new Set(['description', 'style', 'collection']);

function MetadataForm({
  metadata,
  onChange,
  disabled,
  excludeKeys,
}: {
  metadata: ProductMetadata;
  onChange?: (updated: ProductMetadata) => void;
  disabled?: boolean;
  excludeKeys?: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);

  const entries = Object.entries(metadata).filter(
    ([k, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0) && !(excludeKeys?.has(k)),
  );
  if (entries.length === 0) return null;

  const visible = expanded ? entries : entries.slice(0, 4);
  const hasMore = entries.length > 4;
  const readOnly = !onChange;

  function handleFieldChange(key: string, newValue: string) {
    if (!onChange) return;
    const original = metadata[key];
    const updated = { ...metadata };
    if (Array.isArray(original)) {
      updated[key] = newValue.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      updated[key] = newValue;
    }
    onChange(updated);
  }

  return (
    <div style={{
      marginTop: readOnly ? 20 : 0, paddingTop: readOnly ? 18 : 0,
      borderTop: readOnly ? '1px solid var(--border)' : 'none',
    }}>
      <div style={{
        padding: '14px 16px', borderRadius: 10,
        background: 'rgba(50,80,190,0.04)', border: '1px solid rgba(50,80,190,0.12)',
      }}>
        <div
          onClick={() => hasMore && setExpanded(!expanded)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12,
            cursor: hasMore ? 'pointer' : 'default', userSelect: 'none',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3850be" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
          </svg>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#3850be', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Product Details
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {entries.length} field{entries.length !== 1 ? 's' : ''}
          </span>
          {hasMore && (
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3850be" strokeWidth="2.5" strokeLinecap="round"
              style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: readOnly ? 6 : 10 }}>
          {visible.map(([key, value]) => {
            const label = METADATA_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
            const displayValue = Array.isArray(value) ? value.join(', ') : String(value ?? '');

            if (readOnly) {
              return (
                <div key={key} style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)', minWidth: 120, flexShrink: 0 }}>
                    {label}
                  </span>
                  <span style={{ color: 'var(--text-primary)' }}>{displayValue}</span>
                </div>
              );
            }

            const isLongText = key === 'description' || displayValue.length > 80;
            return (
              <div key={key}>
                <label className="form-label" style={{ marginBottom: 4 }}>{label}</label>
                {isLongText ? (
                  <textarea
                    className="input-field"
                    value={displayValue}
                    onChange={(e) => handleFieldChange(key, e.target.value)}
                    disabled={disabled}
                    rows={2}
                    style={{ resize: 'vertical', minHeight: 42 }}
                  />
                ) : (
                  <input
                    className="input-field"
                    type="text"
                    value={displayValue}
                    onChange={(e) => handleFieldChange(key, e.target.value)}
                    disabled={disabled}
                  />
                )}
              </div>
            );
          })}
        </div>
        {hasMore && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            type="button"
            style={{
              marginTop: 8, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11.5, fontWeight: 600, color: '#3850be', padding: 0,
            }}
          >
            Show {entries.length - 4} more fields…
          </button>
        )}
      </div>
    </div>
  );
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Re-extract state
  const [reExtracting, setReExtracting] = useState(false);
  const [reExtractStep, setReExtractStep] = useState(0);
  const [reExtractError, setReExtractError] = useState('');
  const [reExtractPreview, setReExtractPreview] = useState<ExtractedProduct | null>(null);

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
  const [description, setDescription] = useState('');
  const [editMetadata, setEditMetadata] = useState<ProductMetadata | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getProduct(id).then((r) => {
      if (r.data) { setProduct(r.data); populateForm(r.data); }
      setLoading(false);
    });
  }, [id]);

  // Cycle extract step while re-extracting
  useEffect(() => {
    if (!reExtracting) { setReExtractStep(0); return; }
    const interval = setInterval(() => {
      setReExtractStep((s) => Math.min(s + 1, EXTRACT_STEPS.length - 1));
    }, 7000);
    return () => clearInterval(interval);
  }, [reExtracting]);

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
    const md = p.metadata as ProductMetadata | null;
    setDescription((md?.description as string) ?? '');
    setEditMetadata(md);
  }

  function applyReExtract(data: ExtractedProduct) {
    setProductName(data.productName ?? productName);
    setBrandName(data.brandName ?? '');
    setPrice(data.price != null ? String(data.price) : '');
    setImageUrl(data.imageUrl ?? '');
    setProductUrl(data.productUrl ?? '');
    setCategory(data.category ?? '');
    setLeadTime(data.leadTime ?? '');
    setFinishes(data.finishes ?? []);
    if (data.dimensions) {
      setDimLength(data.dimensions.length != null ? String(data.dimensions.length) : '');
      setDimWidth(data.dimensions.width != null ? String(data.dimensions.width) : '');
      setDimHeight(data.dimensions.height != null ? String(data.dimensions.height) : '');
      if (data.dimensions.unit) setDimUnit(data.dimensions.unit as 'in' | 'cm' | 'ft');
    }

    // Carry metadata from re-extraction
    const md = data.metadata as ProductMetadata | undefined;
    setEditMetadata(md ?? null);
    setDescription((md?.description as string) ?? '');

    // Auto-fill material from metadata if extraction didn't provide a top-level one
    const mat = data.material ?? (md?.legMaterial as string) ?? '';
    setMaterial(mat);

    // Auto-fill finishes from availableColors if no finishes were extracted
    if ((!data.finishes || data.finishes.length === 0) && md?.availableColors && Array.isArray(md.availableColors) && md.availableColors.length > 0) {
      setFinishes(md.availableColors as string[]);
    }

    setReExtractPreview(null);
    setEditing(true);
  }

  async function handleReExtract() {
    if (!product) return;
    setReExtracting(true);
    setReExtractError('');
    setReExtractPreview(null);

    const result = await api.extractProduct(product.sourceUrl, true);
    setReExtracting(false);

    if (result.error) {
      setReExtractError(result.error);
      return;
    }

    const data = result.data!;

    if (data.type === 'multiple') {
      setReExtractError('Multiple products found at this URL. Use the catalog page to add individual products.');
      return;
    }

    if (data.product) {
      setReExtractPreview(data.product);
    }
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
    const hasDims = [dimWidth, dimHeight].filter(v => v && parseFloat(v) > 0).length >= 2
      || ([dimWidth, dimHeight, dimLength].filter(v => v && parseFloat(v) > 0).length >= 2);
    if (!hasDims) { setError('Dimensions are required — please enter at least 2 of Width, Height, or Length.'); return; }

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

    // Merge description back into metadata for persistence
    const mergedMetadata: ProductMetadata | null = editMetadata || description.trim()
      ? { ...(editMetadata ?? {}), ...(description.trim() ? { description: description.trim() } : {}) }
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
      metadata: mergedMetadata,
    };

    const result = await api.updateProduct(id, payload);
    setSaving(false);

    if (result.error) { setError(result.error); return; }
    const fresh = await api.getProduct(id);
    if (fresh.data) setProduct(fresh.data);
    setEditing(false);
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError('');
    const result = await api.deleteProduct(id);
    setDeleting(false);
    if (result.error) {
      setDeleteError(result.error);
      setConfirmDelete(false);
      return;
    }
    router.push('/catalog');
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
  const meta = product.metadata as ProductMetadata | null;

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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Re-extract button */}
            <button
              className="btn-ghost"
              onClick={handleReExtract}
              disabled={reExtracting}
              style={{ display: 'flex', alignItems: 'center', gap: 7 }}
            >
              {reExtracting ? (
                <>
                  <svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  {EXTRACT_STEPS[reExtractStep]}
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                  </svg>
                  Re-extract
                </>
              )}
            </button>

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
            <button
              onClick={() => { setDeleteError(''); setConfirmDelete(true); }}
              style={{
                border: '1px solid rgba(180,30,30,0.20)',
                borderRadius: 8, background: 'transparent',
                color: '#b91c1c',
                padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.12s',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>

      {/* ── Delete error ─────────────────────────────────── */}
      {deleteError && (
        <div className="error-box" style={{ marginBottom: 16 }}>{deleteError}</div>
      )}

      {/* ── Re-extract feedback ──────────────────────────── */}
      {reExtractError && (
        <div className="error-box" style={{ marginBottom: 16 }}>{reExtractError}</div>
      )}

      {/* Re-extract preview card */}
      {reExtractPreview && (
        <div className="card" style={{ padding: '20px 24px', marginBottom: 20, border: '1px solid rgba(168,113,10,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Fresh data extracted</span>
            </div>
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              onClick={() => setReExtractPreview(null)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Snapshot of what will be applied */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Name', value: reExtractPreview.productName },
              { label: 'Brand', value: reExtractPreview.brandName || '—' },
              { label: 'Price', value: reExtractPreview.price != null ? `$${reExtractPreview.price.toLocaleString()}` : '—' },
              { label: 'Category', value: reExtractPreview.category || '—' },
              { label: 'Material', value: reExtractPreview.material || '—' },
              { label: 'Lead Time', value: reExtractPreview.leadTime || '—' },
            ].map((row) => (
              <div key={row.label} style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>{row.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            Review the extracted data above. Click Apply to load it into the edit form, then save when ready.
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-primary"
              onClick={() => applyReExtract(reExtractPreview)}
              style={{ display: 'flex', alignItems: 'center', gap: 7 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Apply & Edit
            </button>
            <button className="btn-ghost" onClick={() => setReExtractPreview(null)}>Discard</button>
          </div>
        </div>
      )}

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

      {/* ── Confirm delete dialog ────────────────────────── */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="card" style={{ width: 420, padding: '28px', position: 'relative' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Delete this product?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 22 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{product.productName}</strong> will be permanently removed from your catalog. This cannot be undone.
              {((product._count?.shortlistItems ?? 0) > 0 || (product._count?.cartItems ?? 0) > 0) && (
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 7, background: 'rgba(180,30,30,0.06)', border: '1px solid rgba(180,30,30,0.15)', color: '#b91c1c', fontSize: 12.5 }}>
                  This product is currently in {product._count?.shortlistItems ?? 0} shortlist and {product._count?.cartItems ?? 0} cart item(s). Deletion will be blocked — deactivate instead.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  border: '1px solid rgba(180,30,30,0.3)', borderRadius: 8,
                  background: 'rgba(180,30,30,0.08)', color: '#b91c1c',
                  padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 7,
                }}
              >
                {deleting ? (
                  <>
                    <svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                    Deleting…
                  </>
                ) : 'Delete permanently'}
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
                <Field label="Description" optional>
                  <textarea
                    className="input-field"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Product description…"
                    style={{ resize: 'vertical', minHeight: 60 }}
                  />
                </Field>

                <SectionHeading>Media & links</SectionHeading>
                <Field label="Image URL" optional>
                  <input className="input-field" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                </Field>
                <Field label="Product Page URL" optional>
                  <input className="input-field" type="url" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} />
                </Field>

                <SectionHeading>Dimensions *</SectionHeading>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, marginTop: -8 }}>
                  At least 2 of Width, Height, or Length required
                </div>
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

                {/* Editable metadata */}
                {editMetadata && Object.keys(editMetadata).length > 0 && (
                  <>
                    <SectionHeading>Product Details</SectionHeading>
                    <MetadataForm
                      metadata={editMetadata}
                      onChange={(updated) => setEditMetadata(updated)}
                      disabled={saving}
                    />
                  </>
                )}

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
                  { label: 'Style', value: (meta?.style as string) || '—' },
                  { label: 'Collection', value: (meta?.collection as string) || '—' },
                  { label: 'Shortlisted', value: `${product._count?.shortlistItems ?? 0} time${(product._count?.shortlistItems ?? 0) !== 1 ? 's' : ''}` },
                ].map((row) => (
                  <div key={row.label}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{row.label}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{row.value}</div>
                  </div>
                ))}
              </div>

              {/* Description from metadata */}
              {meta?.description && (
                <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Description</div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.6 }}>{meta.description as string}</div>
                </div>
              )}

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

              {/* AI-extracted metadata (read-only in view mode) */}
              {meta && Object.keys(meta).length > 0 && (
                <MetadataForm metadata={meta} excludeKeys={INLINE_METADATA_KEYS} />
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
