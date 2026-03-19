'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ProductPayload, ExtractedProduct, DuplicateProduct, ProductMetadata } from '@/lib/api';

const EXTRACT_STEPS = [
  'Visiting page…',
  'Reading product details…',
  'Identifying product data…',
  'Almost done…',
];

const MAX_BATCH = 5;

/* ─── Batch form state type ─────────────────────────── */

interface BatchFormState {
  tempId: string;
  sourceUrl: string;
  productName: string;
  brandName: string;
  price: string;
  currency: string;
  imageUrl: string;
  productUrl: string;
  category: string;
  material: string;
  leadTime: string;
  finishes: string[];
  finishInput: string;
  dimLength: string;
  dimWidth: string;
  dimHeight: string;
  dimDepth: string;
  dimUnit: 'in' | 'cm' | 'ft';
  metadata?: ProductMetadata;
  isDuplicate: boolean;
  duplicateProductId?: string;
  extractError?: string;
  saving: boolean;
  saved: boolean;
  savedProductId?: string;
  skipped: boolean;
  error: string;
}

function extractedToBatchForm(data: ExtractedProduct, url: string): BatchFormState {
  return {
    tempId: Math.random().toString(36).slice(2),
    sourceUrl: url,
    productName: data.productName ?? '',
    brandName: data.brandName ?? '',
    price: data.price != null ? String(data.price) : '',
    currency: data.currency ?? 'USD',
    imageUrl: data.imageUrl ?? '',
    productUrl: data.productUrl ?? '',
    category: data.category ?? '',
    material: data.material ?? '',
    leadTime: data.leadTime ?? '',
    finishes: data.finishes ?? [],
    finishInput: '',
    dimLength: data.dimensions?.length != null ? String(data.dimensions.length) : '',
    dimWidth: data.dimensions?.width != null ? String(data.dimensions.width) : '',
    dimHeight: data.dimensions?.height != null ? String(data.dimensions.height) : '',
    dimDepth: data.dimensions?.depth != null ? String(data.dimensions.depth) : '',
    dimUnit: (data.dimensions?.unit as 'in' | 'cm' | 'ft') ?? 'in',
    metadata: data.metadata,
    isDuplicate: false,
    saving: false,
    saved: false,
    skipped: false,
    error: '',
  };
}

/* ─── MetadataSummary ────────────────────────────────── */

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
  seatHeight: 'Seat Height',
  armHeight: 'Arm Height',
  seatDepth: 'Seat Depth',
  legMaterial: 'Leg Material',
  cushionType: 'Cushion Type',
  fabricType: 'Fabric Type',
};

function MetadataSummary({ metadata }: { metadata: ProductMetadata }) {
  const [expanded, setExpanded] = useState(false);

  const entries = Object.entries(metadata).filter(
    ([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0),
  );
  if (entries.length === 0) return null;

  // Show first 3 entries in collapsed, all when expanded
  const visible = expanded ? entries : entries.slice(0, 3);
  const hasMore = entries.length > 3;

  return (
    <div style={{
      marginBottom: 14,
      padding: '12px 14px',
      borderRadius: 10,
      background: 'rgba(50,80,190,0.04)',
      border: '1px solid rgba(50,80,190,0.12)',
    }}>
      <div
        onClick={() => hasMore && setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, marginBottom: visible.length > 0 ? 10 : 0,
          cursor: hasMore ? 'pointer' : 'default', userSelect: 'none',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3850be" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
        </svg>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#3850be', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          AI-Extracted Details
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visible.map(([key, value]) => (
          <div key={key} style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.45 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)', minWidth: 110, flexShrink: 0 }}>
              {METADATA_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
            </span>
            <span style={{ color: 'var(--text-primary)' }}>
              {Array.isArray(value) ? value.join(', ') : String(value)}
            </span>
          </div>
        ))}
      </div>
      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            marginTop: 6, background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11.5, fontWeight: 600, color: '#3850be', padding: 0,
          }}
        >
          Show {entries.length - 3} more…
        </button>
      )}
    </div>
  );
}

/* ─── BatchProductCard ──────────────────────────────── */

function BatchProductCard({
  form,
  index,
  onUpdate,
  onSave,
  onSkip,
  savingAll,
}: {
  form: BatchFormState;
  index: number;
  onUpdate: (updates: Partial<BatchFormState>) => void;
  onSave: () => void;
  onSkip: () => void;
  savingAll: boolean;
}) {
  const numBadge = (
    <div style={{
      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
      background: 'var(--gold)', color: '#fff',
      fontSize: 11, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {index + 1}
    </div>
  );

  // Saved state — collapsed
  if (form.saved) {
    return (
      <div className="card" style={{
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
        borderColor: 'var(--green-border)', background: 'var(--green-dim)',
      }}>
        {numBadge}
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {form.productName}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Saved
        </div>
        <Link
          href={`/catalog/${form.savedProductId}`}
          style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}
        >
          View →
        </Link>
      </div>
    );
  }

  // Skipped state — collapsed
  if (form.skipped) {
    return (
      <div className="card" style={{
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
        opacity: 0.45,
      }}>
        {numBadge}
        <div style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {form.productName || form.sourceUrl} — skipped
        </div>
      </div>
    );
  }

  // Duplicate state
  if (form.isDuplicate) {
    return (
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {numBadge}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
              {form.productName}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              Already in your catalog
            </div>
          </div>
          <Link
            href={`/catalog/${form.duplicateProductId}`}
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)', textDecoration: 'none', flexShrink: 0 }}
          >
            View product →
          </Link>
          <button
            onClick={onSkip}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '4px 8px' }}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // Extraction failed — show error with manual entry option
  if (form.extractError && !form.productName) {
    return (
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          {numBadge}
          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)', wordBreak: 'break-all' }}>{form.sourceUrl}</div>
          <button onClick={onSkip} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '4px 8px', flexShrink: 0 }}>
            Skip
          </button>
        </div>
        <div className="error-box" style={{ marginBottom: 10 }}>{form.extractError}</div>
        <button
          className="btn-ghost"
          style={{ fontSize: 12 }}
          onClick={() => onUpdate({ extractError: undefined, productName: '', sourceUrl: form.sourceUrl })}
        >
          Fill in manually
        </button>
      </div>
    );
  }

  // Normal editable form
  const disabled = form.saving || savingAll;

  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        {numBadge}
        <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {form.productName || 'Untitled product'}
        </div>
        <a
          href={form.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11.5, color: 'var(--gold)', textDecoration: 'none', flexShrink: 0, fontWeight: 500 }}
        >
          Source ↗
        </a>
        <button
          onClick={onSkip}
          disabled={disabled}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '4px 8px', flexShrink: 0 }}
        >
          Skip
        </button>
      </div>

      {/* Row 1: Name + Brand */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label className="form-label">Product Name *</label>
          <input
            className="input-field"
            type="text"
            value={form.productName}
            onChange={(e) => onUpdate({ productName: e.target.value })}
            disabled={disabled}
          />
        </div>
        <div>
          <label className="form-label">Brand <span style={{ fontWeight: 400, fontSize: 10.5, opacity: 0.7 }}>(optional)</span></label>
          <input
            className="input-field"
            type="text"
            value={form.brandName}
            onChange={(e) => onUpdate({ brandName: e.target.value })}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Row 2: Price + Category + Material */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label className="form-label">Price <span style={{ fontWeight: 400, fontSize: 10.5, opacity: 0.7 }}>(optional)</span></label>
          <input
            className="input-field"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={form.price}
            onChange={(e) => onUpdate({ price: e.target.value })}
            disabled={disabled}
          />
        </div>
        <div>
          <label className="form-label">Category <span style={{ fontWeight: 400, fontSize: 10.5, opacity: 0.7 }}>(optional)</span></label>
          <input
            className="input-field"
            type="text"
            value={form.category}
            onChange={(e) => onUpdate({ category: e.target.value })}
            disabled={disabled}
          />
        </div>
        <div>
          <label className="form-label">Material <span style={{ fontWeight: 400, fontSize: 10.5, opacity: 0.7 }}>(optional)</span></label>
          <input
            className="input-field"
            type="text"
            value={form.material}
            onChange={(e) => onUpdate({ material: e.target.value })}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Row 3: Image URL + preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px', gap: 10, alignItems: 'flex-end', marginBottom: 10 }}>
        <div>
          <label className="form-label">Image URL <span style={{ fontWeight: 400, fontSize: 10.5, opacity: 0.7 }}>(optional)</span></label>
          <input
            className="input-field"
            type="url"
            value={form.imageUrl}
            onChange={(e) => onUpdate({ imageUrl: e.target.value })}
            disabled={disabled}
          />
        </div>
        <div style={{
          width: 64, height: 64, borderRadius: 8, overflow: 'hidden',
          border: '1px solid var(--border)', background: 'var(--bg-input)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {form.imageUrl ? (
            <img
              src={form.imageUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
          )}
        </div>
      </div>

      {/* Row 4: Dimensions + Lead Time */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 70px 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label className="form-label">Length</label>
          <input className="input-field" type="number" min="0" step="0.1" placeholder="0" value={form.dimLength} onChange={(e) => onUpdate({ dimLength: e.target.value })} disabled={disabled} />
        </div>
        <div>
          <label className="form-label">Width</label>
          <input className="input-field" type="number" min="0" step="0.1" placeholder="0" value={form.dimWidth} onChange={(e) => onUpdate({ dimWidth: e.target.value })} disabled={disabled} />
        </div>
        <div>
          <label className="form-label">Height</label>
          <input className="input-field" type="number" min="0" step="0.1" placeholder="0" value={form.dimHeight} onChange={(e) => onUpdate({ dimHeight: e.target.value })} disabled={disabled} />
        </div>
        <div>
          <label className="form-label">Depth</label>
          <input className="input-field" type="number" min="0" step="0.1" placeholder="0" value={form.dimDepth} onChange={(e) => onUpdate({ dimDepth: e.target.value })} disabled={disabled} />
        </div>
        <div>
          <label className="form-label">Unit</label>
          <select className="select-field" value={form.dimUnit} onChange={(e) => onUpdate({ dimUnit: e.target.value as 'in' | 'cm' | 'ft' })} disabled={disabled}>
            <option value="in">in</option><option value="cm">cm</option><option value="ft">ft</option>
          </select>
        </div>
        <div>
          <label className="form-label">Lead Time</label>
          <input className="input-field" type="text" placeholder="e.g. 4-6 wks" value={form.leadTime} onChange={(e) => onUpdate({ leadTime: e.target.value })} disabled={disabled} />
        </div>
      </div>

      {/* Finishes */}
      <div style={{ marginBottom: 14 }}>
        <label className="form-label">Finishes <span style={{ fontWeight: 400, fontSize: 10.5, opacity: 0.7 }}>(optional)</span></label>
        <div style={{ display: 'flex', gap: 8, marginBottom: form.finishes.length > 0 ? 8 : 0 }}>
          <input
            className="input-field"
            type="text"
            placeholder="Add a finish…"
            value={form.finishInput}
            onChange={(e) => onUpdate({ finishInput: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const val = form.finishInput.trim();
                if (val && !form.finishes.includes(val)) {
                  onUpdate({ finishes: [...form.finishes, val], finishInput: '' });
                } else {
                  onUpdate({ finishInput: '' });
                }
              }
            }}
            disabled={disabled}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: 12, flexShrink: 0 }}
            disabled={disabled}
            onClick={() => {
              const val = form.finishInput.trim();
              if (val && !form.finishes.includes(val)) {
                onUpdate({ finishes: [...form.finishes, val], finishInput: '' });
              } else {
                onUpdate({ finishInput: '' });
              }
            }}
          >
            Add
          </button>
        </div>
        {form.finishes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {form.finishes.map((f) => (
              <span
                key={f}
                className="tag-chip"
                style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                onClick={() => !disabled && onUpdate({ finishes: form.finishes.filter((x) => x !== f) })}
              >
                {f}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* AI-extracted metadata summary */}
      {form.metadata && Object.keys(form.metadata).length > 0 && (
        <MetadataSummary metadata={form.metadata} />
      )}

      {/* Error */}
      {form.error && <div className="error-box" style={{ marginBottom: 12 }}>{form.error}</div>}

      {/* Save button */}
      <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          className="btn-primary"
          onClick={onSave}
          disabled={disabled}
          style={{ display: 'flex', alignItems: 'center', gap: 7 }}
        >
          {form.saving ? (
            <>
              <svg className="anim-rotate" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
              Saving…
            </>
          ) : (
            <>
              Save product
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ─── Shared sub-components ─────────────────────────── */

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

/* ─── Main page ─────────────────────────────────────── */

export default function NewProductPage() {
  const router = useRouter();

  // Extract state
  const [extractUrl, setExtractUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractStep, setExtractStep] = useState(0);
  const [extractError, setExtractError] = useState('');
  const [extracted, setExtracted] = useState(false);
  const [collectionProducts, setCollectionProducts] = useState<ExtractedProduct[] | null>(null);
  const [collectionTotal, setCollectionTotal] = useState(0);
  const [collectionSearch, setCollectionSearch] = useState('');
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [pickingProduct, setPickingProduct] = useState(false);
  const [imageUrlWarning, setImageUrlWarning] = useState(false);

  // Batch state
  const [extractingBatch, setExtractingBatch] = useState(false);
  const [batchForms, setBatchForms] = useState<BatchFormState[]>([]);
  const [savingAll, setSavingAll] = useState(false);

  // Duplicate modal (single extract flow)
  const [duplicateProduct, setDuplicateProduct] = useState<DuplicateProduct | null>(null);

  // Rate limit countdown
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const rateLimitTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Single form state
  const [productName, setProductName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [brandName, setBrandName] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [category, setCategory] = useState('');
  const [material, setMaterial] = useState('');
  const [leadTime, setLeadTime] = useState('');
  const [finishInput, setFinishInput] = useState('');
  const [finishes, setFinishes] = useState<string[]>([]);
  const [dimLength, setDimLength] = useState('');
  const [dimWidth, setDimWidth] = useState('');
  const [dimHeight, setDimHeight] = useState('');
  const [dimDepth, setDimDepth] = useState('');
  const [dimUnit, setDimUnit] = useState<'in' | 'cm' | 'ft'>('in');
  const [currency, setCurrency] = useState('USD');
  const [singleMetadata, setSingleMetadata] = useState<ProductMetadata | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Cycle extract steps while extracting
  useEffect(() => {
    if (!extracting) { setExtractStep(0); return; }
    const interval = setInterval(() => setExtractStep((s) => Math.min(s + 1, EXTRACT_STEPS.length - 1)), 7000);
    return () => clearInterval(interval);
  }, [extracting]);

  // Rate limit countdown
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    rateLimitTimer.current = setInterval(() => {
      setRateLimitSeconds((s) => {
        if (s <= 1) { if (rateLimitTimer.current) clearInterval(rateLimitTimer.current); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => { if (rateLimitTimer.current) clearInterval(rateLimitTimer.current); };
  }, [rateLimitSeconds]);

  /* ── Single extract ──────────────────────────────── */

  function applyExtractedProduct(data: ExtractedProduct, url?: string) {
    if (url) setSourceUrl(url);
    setProductName(data.productName ?? '');
    setBrandName(data.brandName ?? '');
    setPrice(data.price != null ? String(data.price) : '');
    setCurrency(data.currency ?? 'USD');
    setImageUrl(data.imageUrl ?? '');
    setProductUrl(data.productUrl ?? '');
    setCategory(data.category ?? '');
    setMaterial(data.material ?? '');
    setLeadTime(data.leadTime ?? '');
    setFinishes(data.finishes ?? []);
    if (data.dimensions) {
      setDimLength(data.dimensions.length != null ? String(data.dimensions.length) : '');
      setDimWidth(data.dimensions.width != null ? String(data.dimensions.width) : '');
      setDimHeight(data.dimensions.height != null ? String(data.dimensions.height) : '');
      setDimDepth(data.dimensions.depth != null ? String(data.dimensions.depth) : '');
      if (data.dimensions.unit) setDimUnit(data.dimensions.unit as 'in' | 'cm' | 'ft');
    }
    setSingleMetadata(data.metadata);
    setExtracted(true);
    setCollectionProducts(null);
    setCollectionSearch('');
    setSelectedIndices(new Set());
  }

  async function handleExtract() {
    if (!extractUrl.trim()) { setExtractError('Please enter a URL.'); return; }
    if (rateLimitSeconds > 0) return;

    setExtracting(true);
    setExtractError('');
    setCollectionProducts(null);
    setCollectionSearch('');
    setSelectedIndices(new Set());
    setExtracted(false);
    setDuplicateProduct(null);
    setBatchForms([]);

    const result = await api.extractProduct(extractUrl.trim());
    setExtracting(false);

    if (result.error) {
      if (!sourceUrl) setSourceUrl(extractUrl.trim());
      const anyResult = result as any;
      if (anyResult.retryAfter) setRateLimitSeconds(anyResult.retryAfter);
      setExtractError(result.error);
      return;
    }

    const data = result.data!;

    if (data.type === 'duplicate' && data.duplicateProduct) {
      setDuplicateProduct(data.duplicateProduct);
      return;
    }

    if (data.type === 'multiple' && data.products && data.products.length > 0) {
      setCollectionProducts(data.products);
      setCollectionTotal(data.totalFound ?? data.products.length);
      return;
    }

    if (data.product) {
      applyExtractedProduct(data.product, data.product.productUrl || extractUrl.trim());
      if (!sourceUrl) setSourceUrl(extractUrl.trim());
    }
  }

  /* ── Collection checkbox selection ──────────────── */

  function toggleSelection(index: number) {
    const product = collectionProducts?.[index];
    if (!product?.productUrl) return; // can't extract without a URL
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else if (next.size < MAX_BATCH) {
        next.add(index);
      }
      return next;
    });
  }

  /* ── Batch extract ───────────────────────────────── */

  async function handleBatchExtract() {
    const urls = Array.from(selectedIndices)
      .map((i) => collectionProducts![i].productUrl)
      .filter((u): u is string => !!u);

    if (urls.length === 0) return;

    setExtractingBatch(true);
    setExtractError('');

    const result = await api.extractProductsBatch(urls);
    setExtractingBatch(false);

    if (result.error) {
      const anyResult = result as any;
      if (anyResult.retryAfter) setRateLimitSeconds(anyResult.retryAfter);
      setExtractError(result.error);
      return;
    }

    const forms: BatchFormState[] = result.data!.results.map((item) => {
      if (item.type === 'duplicate' && item.duplicateProduct) {
        return {
          tempId: Math.random().toString(36).slice(2),
          sourceUrl: item.url,
          productName: item.duplicateProduct.productName,
          brandName: item.duplicateProduct.brandName ?? '',
          price: '', currency: 'USD', imageUrl: item.duplicateProduct.imageUrl ?? '',
          productUrl: '', category: '', material: '', leadTime: '',
          finishes: [], finishInput: '',
          dimLength: '', dimWidth: '', dimHeight: '', dimDepth: '', dimUnit: 'in' as const,
          isDuplicate: true,
          duplicateProductId: item.duplicateProduct.id,
          saving: false, saved: false, skipped: false, error: '',
        };
      }

      if (item.type === 'error' || !item.product) {
        return {
          tempId: Math.random().toString(36).slice(2),
          sourceUrl: item.url,
          productName: '', brandName: '', price: '', currency: 'USD', imageUrl: '', productUrl: '',
          category: '', material: '', leadTime: '', finishes: [], finishInput: '',
          dimLength: '', dimWidth: '', dimHeight: '', dimDepth: '', dimUnit: 'in' as const,
          isDuplicate: false,
          extractError: item.error || 'Could not extract product details.',
          saving: false, saved: false, skipped: false, error: '',
        };
      }

      return extractedToBatchForm(item.product!, item.url);
    });

    setBatchForms(forms);
    setCollectionProducts(null);
    setSelectedIndices(new Set());
  }

  /* ── Batch form helpers ──────────────────────────── */

  function updateBatchForm(tempId: string, updates: Partial<BatchFormState>) {
    setBatchForms((prev) => prev.map((f) => f.tempId === tempId ? { ...f, ...updates } : f));
  }

  async function handleSaveBatchItem(tempId: string) {
    const form = batchForms.find((f) => f.tempId === tempId);
    if (!form || form.saved || form.skipped || form.isDuplicate) return;

    if (!form.productName.trim()) { updateBatchForm(tempId, { error: 'Product name is required.' }); return; }
    if (!form.sourceUrl.trim()) { updateBatchForm(tempId, { error: 'Source URL is required.' }); return; }

    updateBatchForm(tempId, { saving: true, error: '' });

    const dimensions = (form.dimLength || form.dimWidth || form.dimHeight || form.dimDepth)
      ? {
          length: form.dimLength ? parseFloat(form.dimLength) : undefined,
          width: form.dimWidth ? parseFloat(form.dimWidth) : undefined,
          height: form.dimHeight ? parseFloat(form.dimHeight) : undefined,
          depth: form.dimDepth ? parseFloat(form.dimDepth) : undefined,
          unit: form.dimUnit,
        }
      : undefined;

    const payload: ProductPayload = {
      productName: form.productName.trim(),
      sourceUrl: form.sourceUrl.trim(),
      brandName: form.brandName.trim() || undefined,
      price: form.price ? parseFloat(form.price) : undefined,
      currency: form.currency || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      productUrl: form.productUrl.trim() || undefined,
      category: form.category.trim() || undefined,
      material: form.material.trim() || undefined,
      leadTime: form.leadTime.trim() || undefined,
      finishes: form.finishes.length > 0 ? form.finishes : undefined,
      dimensions,
      metadata: form.metadata && Object.keys(form.metadata).length > 0 ? form.metadata : undefined,
    };

    const result = await api.createProduct(payload);
    if (result.error) {
      updateBatchForm(tempId, { saving: false, error: result.error });
      return;
    }
    updateBatchForm(tempId, { saving: false, saved: true, savedProductId: result.data!.id });
  }

  async function handleSaveAll() {
    setSavingAll(true);
    const pending = batchForms.filter((f) => !f.saved && !f.skipped && !f.isDuplicate && !(f.extractError && !f.productName));
    for (const form of pending) {
      await handleSaveBatchItem(form.tempId);
    }
    setSavingAll(false);
  }

  /* ── Single form helpers ─────────────────────────── */

  async function handlePickProduct(product: ExtractedProduct) {
    const targetUrl = product.productUrl;
    if (targetUrl) {
      setPickingProduct(true);
      setExtractError('');
      const result = await api.extractProduct(targetUrl);
      setPickingProduct(false);
      if (!result.error && result.data?.type === 'single' && result.data.product) {
        applyExtractedProduct(result.data.product, targetUrl);
        return;
      }
    }
    applyExtractedProduct(product, targetUrl || extractUrl.trim());
  }

  function addFinish() {
    const val = finishInput.trim();
    if (val && !finishes.includes(val)) setFinishes([...finishes, val]);
    setFinishInput('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim()) { setError('Product name is required.'); return; }
    if (!sourceUrl.trim()) { setError('Source URL is required.'); return; }

    setLoading(true);
    setError('');
    setImageUrlWarning(false);

    const dimensions = (dimLength || dimWidth || dimHeight || dimDepth)
      ? { length: dimLength ? parseFloat(dimLength) : undefined, width: dimWidth ? parseFloat(dimWidth) : undefined, height: dimHeight ? parseFloat(dimHeight) : undefined, depth: dimDepth ? parseFloat(dimDepth) : undefined, unit: dimUnit }
      : undefined;

    const payload: ProductPayload = {
      productName: productName.trim(), sourceUrl: sourceUrl.trim(),
      brandName: brandName.trim() || undefined, price: price ? parseFloat(price) : undefined,
      currency: currency || undefined,
      imageUrl: imageUrl.trim() || undefined, productUrl: productUrl.trim() || undefined,
      category: category.trim() || undefined, material: material.trim() || undefined,
      leadTime: leadTime.trim() || undefined,
      finishes: finishes.length > 0 ? finishes : undefined, dimensions,
      metadata: singleMetadata && Object.keys(singleMetadata).length > 0 ? singleMetadata : undefined,
    };

    const result = await api.createProduct(payload);
    setLoading(false);
    if (result.error) { setError(result.error); return; }

    const anyResult = result.data as any;
    if (anyResult?.imageUrlWarning) {
      setImageUrlWarning(true);
      setImageUrl('');
      setTimeout(() => router.push(`/catalog/${anyResult.id}`), 2000);
      return;
    }
    router.push(`/catalog/${result.data!.id}`);
  }

  /* ── Derived values ──────────────────────────────── */

  const filteredCollection = collectionProducts
    ? collectionSearch.trim()
      ? collectionProducts.filter((p) =>
          p.productName.toLowerCase().includes(collectionSearch.toLowerCase()) ||
          (p.brandName ?? '').toLowerCase().includes(collectionSearch.toLowerCase())
        )
      : collectionProducts
    : null;

  const batchActive = batchForms.length > 0;
  const batchSavedCount = batchForms.filter((f) => f.saved).length;
  const batchPendingCount = batchForms.filter((f) => !f.saved && !f.skipped && !f.isDuplicate && !(f.extractError && !f.productName)).length;

  /* ── Render ──────────────────────────────────────── */

  return (
    <div style={{ padding: '40px 44px', maxWidth: 700 }}>

      {/* ── Duplicate modal (single flow) ────────────── */}
      {duplicateProduct && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 420, padding: '28px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {duplicateProduct.imageUrl ? (
                  <img src={duplicateProduct.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                )}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Product already in catalog</div>
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 8, marginBottom: 20, background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{duplicateProduct.productName}</div>
              {duplicateProduct.brandName && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{duplicateProduct.brandName}</div>}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 22 }}>
              This URL is already saved in your catalog. View the existing product or dismiss to add manually.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Link href={`/catalog/${duplicateProduct.id}`} className="btn-primary" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>View product</Link>
              <button className="btn-ghost" onClick={() => setDuplicateProduct(null)}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Back + header ──────────────────────────────── */}
      <Link href="/catalog" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, textDecoration: 'none', marginBottom: 28 }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        Back to catalog
      </Link>

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.035em', marginBottom: 4 }}>Add a product</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Paste a product URL to auto-fill details, or enter them manually.</p>
      </div>

      {/* ── Extract from URL card ───────────────────────── */}
      <div className="card" style={{ padding: '24px 28px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Auto-extract from URL</div>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
          Paste a product page or collection URL. For collections, pick up to {MAX_BATCH} products to extract.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            className="input-field"
            type="url"
            placeholder="https://vendor.com/product-or-collection"
            value={extractUrl}
            onChange={(e) => { setExtractUrl(e.target.value); setExtractError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleExtract(); } }}
            style={{ flex: 1 }}
            disabled={extracting}
          />
          <button
            className="btn-primary"
            onClick={handleExtract}
            disabled={extracting || !extractUrl.trim() || rateLimitSeconds > 0}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, minWidth: 110 }}
          >
            {extracting ? (
              <><svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>Extracting…</>
            ) : rateLimitSeconds > 0 ? `Wait ${rateLimitSeconds}s` : (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>Extract</>
            )}
          </button>
        </div>

        {/* Extraction progress */}
        {extracting && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(168,113,10,0.06)', border: '1px solid rgba(168,113,10,0.15)', fontSize: 12.5, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg className="anim-rotate" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
            <span style={{ fontWeight: 500 }}>{EXTRACT_STEPS[extractStep]}</span>
            <span style={{ opacity: 0.6, marginLeft: 'auto', fontSize: 11 }}>Usually takes 10–20s</span>
          </div>
        )}

        {/* Error with retry */}
        {extractError && !extracting && (
          <div style={{ marginTop: 12 }}>
            <div className="error-box" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <span>{extractError}</span>
              {rateLimitSeconds <= 0 && (
                <button onClick={handleExtract} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'inherit', textDecoration: 'underline', padding: 0 }}>
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {/* Single product success */}
        {extracted && !collectionProducts && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--green-dim)', border: '1px solid var(--green-border)', fontSize: 12.5, fontWeight: 600, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
            Product details extracted. Review and edit below, then save.
          </div>
        )}

        {/* ── Collection picker ─────────────────────── */}
        {filteredCollection !== null && collectionProducts && collectionProducts.length > 0 && (
          <div style={{ marginTop: 16 }}>
            {/* Header */}
            <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 12, background: 'rgba(50,80,190,0.06)', border: '1px solid rgba(50,80,190,0.15)', fontSize: 12.5, fontWeight: 600, color: '#3850be', display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              </svg>
              Collection page — {collectionTotal} products found
              <span style={{ marginLeft: 'auto', fontWeight: 500 }}>Select up to {MAX_BATCH}</span>
            </div>

            {/* Search + count */}
            <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                className="input-field"
                type="text"
                placeholder="Filter products…"
                value={collectionSearch}
                onChange={(e) => setCollectionSearch(e.target.value)}
                style={{ flex: 1, fontSize: 12.5 }}
              />
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', flexShrink: 0 }}>
                {filteredCollection.length} of {collectionProducts.length} shown
              </span>
            </div>

            {/* Product list with checkboxes */}
            {pickingProduct && (
              <div style={{ marginBottom: 8, padding: '9px 14px', borderRadius: 8, background: 'rgba(168,113,10,0.06)', border: '1px solid rgba(168,113,10,0.15)', fontSize: 12.5, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg className="anim-rotate" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
                Getting full product details…
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflow: 'auto', marginBottom: 14 }}>
              {filteredCollection.length === 0 ? (
                <div style={{ padding: '14px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>No products match your filter.</div>
              ) : (
                filteredCollection.map((p, i) => {
                  // Find original index for selection tracking
                  const originalIndex = collectionProducts.indexOf(p);
                  const isSelected = selectedIndices.has(originalIndex);
                  const hasUrl = !!p.productUrl;
                  const maxReached = selectedIndices.size >= MAX_BATCH && !isSelected;

                  return (
                    <div
                      key={i}
                      onClick={() => !maxReached && hasUrl && toggleSelection(originalIndex)}
                      style={{
                        display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 10,
                        border: `1px solid ${isSelected ? 'var(--gold)' : 'var(--border)'}`,
                        background: isSelected ? 'rgba(168,113,10,0.05)' : '',
                        cursor: hasUrl && !maxReached ? 'pointer' : 'default',
                        opacity: !hasUrl || (maxReached) ? 0.45 : 1,
                        transition: 'all 0.1s',
                      }}
                    >
                      {/* Checkbox */}
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                        border: `2px solid ${isSelected ? 'var(--gold)' : 'var(--border-strong)'}`,
                        background: isSelected ? 'var(--gold)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>

                      {/* Thumbnail */}
                      <div style={{ width: 44, height: 44, borderRadius: 7, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.productName}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {[p.brandName, p.category].filter(Boolean).join(' · ')}
                          {!hasUrl && <span style={{ color: '#b91c1c', marginLeft: 6 }}>No URL</span>}
                        </div>
                      </div>

                      {/* Price */}
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
                        {p.price != null ? `$${p.price.toLocaleString()}` : ''}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selection footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {selectedIndices.size === 0
                  ? 'Select products to extract'
                  : <><strong style={{ color: 'var(--text-primary)' }}>{selectedIndices.size}</strong> of {MAX_BATCH} selected</>
                }
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {selectedIndices.size > 0 && (
                  <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setSelectedIndices(new Set())}>
                    Clear
                  </button>
                )}
                <button
                  className="btn-primary"
                  onClick={handleBatchExtract}
                  disabled={selectedIndices.size === 0 || extractingBatch}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}
                >
                  {extractingBatch ? (
                    <><svg className="anim-rotate" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>Extracting {selectedIndices.size}…</>
                  ) : (
                    <>Extract {selectedIndices.size > 0 ? `${selectedIndices.size} ` : ''}selected</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Batch forms ─────────────────────────────────── */}
      {batchActive && (
        <div style={{ marginBottom: 20 }}>
          {/* Batch header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Review & save — {batchForms.length} product{batchForms.length !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {batchSavedCount > 0 && <span style={{ color: 'var(--green)', fontWeight: 600 }}>{batchSavedCount} saved</span>}
                {batchSavedCount > 0 && batchPendingCount > 0 && ' · '}
                {batchPendingCount > 0 && `${batchPendingCount} remaining`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {batchPendingCount > 1 && (
                <button
                  className="btn-primary"
                  onClick={handleSaveAll}
                  disabled={savingAll}
                  style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}
                >
                  {savingAll ? (
                    <><svg className="anim-rotate" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>Saving all…</>
                  ) : `Save all (${batchPendingCount})`}
                </button>
              )}
              <button
                className="btn-ghost"
                style={{ fontSize: 12 }}
                onClick={() => { setBatchForms([]); setExtracted(false); }}
              >
                Start over
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {batchForms.map((form, index) => (
              <BatchProductCard
                key={form.tempId}
                form={form}
                index={index}
                onUpdate={(updates) => updateBatchForm(form.tempId, updates)}
                onSave={() => handleSaveBatchItem(form.tempId)}
                onSkip={() => updateBatchForm(form.tempId, { skipped: true })}
                savingAll={savingAll}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── OR divider (hidden during batch) ────────────── */}
      {!batchActive && <div className="divider" style={{ margin: '24px 0' }}>or add manually</div>}

      {/* ── Single form (hidden during batch) ───────────── */}
      {!batchActive && (
        <div className="card" style={{ padding: 32 }}>
          <form onSubmit={handleSubmit} noValidate>
            <SectionHeading>Product information</SectionHeading>
            <Field label="Product Name *">
              <input className="input-field" type="text" placeholder="e.g. Eames Lounge Chair" value={productName} onChange={(e) => setProductName(e.target.value)} />
            </Field>
            <Field label="Source URL *">
              <input className="input-field" type="url" placeholder="https://vendor.com/product-page" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Brand" optional><input className="input-field" type="text" placeholder="Herman Miller" value={brandName} onChange={(e) => setBrandName(e.target.value)} /></Field>
              <Field label="Price" optional><input className="input-field" type="number" placeholder="0.00" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Category" optional><input className="input-field" type="text" placeholder="Seating, Lighting, Tables…" value={category} onChange={(e) => setCategory(e.target.value)} /></Field>
              <Field label="Material" optional><input className="input-field" type="text" placeholder="Leather, Wood, Metal…" value={material} onChange={(e) => setMaterial(e.target.value)} /></Field>
            </div>

            <SectionHeading>Media & links <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10.5, opacity: 0.7 }}>(optional)</span></SectionHeading>

            {imageUrlWarning && (
              <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(168,113,10,0.06)', border: '1px solid rgba(168,113,10,0.2)', fontSize: 12.5, color: 'var(--gold)' }}>
                The image URL could not be verified and was removed. You can add one manually below.
              </div>
            )}
            {imageUrl && (
              <div style={{ marginBottom: 14, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', height: 160, background: 'var(--bg-input)' }}>
                <img src={imageUrl} alt="Product preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
            <Field label="Image URL" optional><input className="input-field" type="url" placeholder="https://images.vendor.com/product.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} /></Field>
            <Field label="Product Page URL" optional><input className="input-field" type="url" placeholder="https://vendor.com/product" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} /></Field>

            <SectionHeading>Dimensions <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10.5, opacity: 0.7 }}>(optional)</span></SectionHeading>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 90px', gap: 12 }}>
              <Field label="Length"><input className="input-field" type="number" placeholder="0" min="0" step="0.1" value={dimLength} onChange={(e) => setDimLength(e.target.value)} /></Field>
              <Field label="Width"><input className="input-field" type="number" placeholder="0" min="0" step="0.1" value={dimWidth} onChange={(e) => setDimWidth(e.target.value)} /></Field>
              <Field label="Height"><input className="input-field" type="number" placeholder="0" min="0" step="0.1" value={dimHeight} onChange={(e) => setDimHeight(e.target.value)} /></Field>
              <Field label="Depth"><input className="input-field" type="number" placeholder="0" min="0" step="0.1" value={dimDepth} onChange={(e) => setDimDepth(e.target.value)} /></Field>
              <Field label="Unit"><select className="select-field" value={dimUnit} onChange={(e) => setDimUnit(e.target.value as 'in' | 'cm' | 'ft')}><option value="in">in</option><option value="cm">cm</option><option value="ft">ft</option></select></Field>
            </div>

            <SectionHeading>Finishes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10.5, opacity: 0.7 }}>(optional)</span></SectionHeading>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input className="input-field" type="text" placeholder="Add a finish…" value={finishInput} onChange={(e) => setFinishInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFinish(); } }} style={{ flex: 1 }} />
              <button type="button" className="btn-ghost" onClick={addFinish} style={{ flexShrink: 0, fontSize: 12 }}>Add</button>
            </div>
            {finishes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {finishes.map((f) => (
                  <span key={f} className="tag-chip" style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }} onClick={() => setFinishes(finishes.filter((x) => x !== f))}>
                    {f}<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </span>
                ))}
              </div>
            )}

            <Field label="Lead Time" optional><input className="input-field" type="text" placeholder="e.g. 4-6 weeks" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} /></Field>

            {/* AI-extracted metadata summary */}
            {singleMetadata && Object.keys(singleMetadata).length > 0 && (
              <>
                <SectionHeading>AI-Extracted Details</SectionHeading>
                <MetadataSummary metadata={singleMetadata} />
              </>
            )}

            {error && <div className="error-box" style={{ marginBottom: 20 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 28, paddingTop: 22, borderTop: '1px solid var(--border)' }}>
              <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
                {loading ? <><svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>Saving…</> : <>Save product <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg></>}
              </button>
              <Link href="/catalog" className="btn-ghost" style={{ textDecoration: 'none' }}>Cancel</Link>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
