'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ProductPayload, ExtractedProduct, DuplicateProduct, ProductMetadata, ProductImages, ProductOption } from '@/lib/api';

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
  // New variant-aware fields
  variantId?: string;
  sku?: string;
  activeVariant?: Record<string, string | number>;
  images?: ProductImages;
  pricing?: Array<Record<string, string | number>>;
  availableOptions?: ProductOption[];
  features?: string[];
  materials?: Record<string, string | string[]>;
  promotions?: string[];
  shipping?: string;
  availability?: string;
  // UI state
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
  const activePrice = data.activeVariant?.price ?? data.price;
  return {
    tempId: Math.random().toString(36).slice(2),
    sourceUrl: url,
    productName: data.productName ?? '',
    brandName: data.brandName ?? '',
    price: activePrice != null ? String(activePrice) : '',
    currency: data.currency ?? 'USD',
    imageUrl: data.images?.primary ?? data.imageUrl ?? '',
    productUrl: data.productUrl ?? '',
    category: data.category ?? '',
    material: (typeof data.materials?.primary === 'string' ? data.materials.primary : data.material) ?? '',
    leadTime: data.leadTime ?? '',
    finishes: data.finishes ?? [],
    finishInput: '',
    dimLength: data.dimensions?.length != null ? String(data.dimensions.length) : '',
    dimWidth: data.dimensions?.width != null ? String(data.dimensions.width) : '',
    dimHeight: data.dimensions?.height != null ? String(data.dimensions.height) : '',
    dimDepth: data.dimensions?.depth != null ? String(data.dimensions.depth) : '',
    dimUnit: (data.dimensions?.unit as 'in' | 'cm' | 'ft') ?? 'in',
    metadata: data.metadata,
    // New variant-aware fields
    variantId: data.variantId,
    sku: data.sku,
    activeVariant: data.activeVariant,
    images: data.images,
    pricing: data.pricing,
    availableOptions: data.availableOptions,
    features: data.features,
    materials: data.materials,
    promotions: data.promotions,
    shipping: data.shipping,
    availability: data.availability,
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
  availableSizes: 'Available Sizes',
  seatHeight: 'Seat Height',
  armHeight: 'Arm Height',
  seatDepth: 'Seat Depth',
  legMaterial: 'Leg Material',
  cushionType: 'Cushion Type',
  fabricType: 'Fabric Type',
};

function MetadataForm({
  metadata,
  onChange,
  disabled,
}: {
  metadata: ProductMetadata;
  onChange: (updated: ProductMetadata) => void;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const entries = Object.entries(metadata).filter(
    ([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0),
  );
  if (entries.length === 0) return null;

  const visible = expanded ? entries : entries.slice(0, 4);
  const hasMore = entries.length > 4;

  function handleFieldChange(key: string, newValue: string) {
    const original = metadata[key];
    const updated = { ...metadata };
    if (Array.isArray(original)) {
      // For array fields, split by comma
      updated[key] = newValue.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      updated[key] = newValue;
    }
    onChange(updated);
  }

  return (
    <div style={{
      marginBottom: 14,
      padding: '14px 16px',
      borderRadius: 10,
      background: 'rgba(50,80,190,0.04)',
      border: '1px solid rgba(50,80,190,0.12)',
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map(([key, value]) => {
          const label = METADATA_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          const displayValue = Array.isArray(value) ? value.join(', ') : String(value ?? '');
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

      {/* Row 4: Dimensions (required) + Lead Time */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 70px 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label className="form-label">Length</label>
          <input className="input-field" type="number" min="0" step="0.1" placeholder="0" value={form.dimLength} onChange={(e) => onUpdate({ dimLength: e.target.value })} disabled={disabled} />
        </div>
        <div>
          <label className="form-label">Width *</label>
          <input className="input-field" type="number" min="0" step="0.1" placeholder="0" value={form.dimWidth} onChange={(e) => onUpdate({ dimWidth: e.target.value })} disabled={disabled} />
        </div>
        <div>
          <label className="form-label">Height *</label>
          <input className="input-field" type="number" min="0" step="0.1" placeholder="0" value={form.dimHeight} onChange={(e) => onUpdate({ dimHeight: e.target.value })} disabled={disabled} />
        </div>
        <div>
          <label className="form-label">Depth *</label>
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

      {/* AI-extracted metadata — editable */}
      {form.metadata && Object.keys(form.metadata).length > 0 && (
        <MetadataForm
          metadata={form.metadata}
          onChange={(updated) => onUpdate({ metadata: updated })}
          disabled={disabled}
        />
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
  // New variant-aware state (passed through to API, not individually edited in form)
  const [singleVariantId, setSingleVariantId] = useState<string | undefined>();
  const [singleSku, setSingleSku] = useState<string | undefined>();
  const [singleActiveVariant, setSingleActiveVariant] = useState<Record<string, string | number> | undefined>();
  const [singleImages, setSingleImages] = useState<ProductImages | undefined>();
  const [singlePricing, setSinglePricing] = useState<Array<Record<string, string | number>> | undefined>();
  const [singleAvailableOptions, setSingleAvailableOptions] = useState<ProductOption[] | undefined>();
  const [singleFeatures, setSingleFeatures] = useState<string[] | undefined>();
  const [singleMaterials, setSingleMaterials] = useState<Record<string, string | string[]> | undefined>();
  const [singlePromotions, setSinglePromotions] = useState<string[] | undefined>();
  const [singleShipping, setSingleShipping] = useState<string | undefined>();
  const [singleAvailability, setSingleAvailability] = useState<string | undefined>();
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
    const activePrice = data.activeVariant?.price ?? data.price;
    setPrice(activePrice != null ? String(activePrice) : '');
    setCurrency(data.currency ?? 'USD');
    setImageUrl(data.images?.primary ?? data.imageUrl ?? '');
    setProductUrl(data.productUrl ?? '');
    setCategory(data.category ?? '');
    setMaterial((typeof data.materials?.primary === 'string' ? data.materials.primary : data.material) ?? '');
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
    // Set new variant-aware fields
    setSingleVariantId(data.variantId);
    setSingleSku(data.sku);
    setSingleActiveVariant(data.activeVariant);
    setSingleImages(data.images);
    setSinglePricing(data.pricing);
    setSingleAvailableOptions(data.availableOptions);
    setSingleFeatures(data.features);
    setSingleMaterials(data.materials);
    setSinglePromotions(data.promotions);
    setSingleShipping(data.shipping);
    setSingleAvailability(data.availability);
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
    const hasDims = [form.dimWidth, form.dimHeight, form.dimDepth].filter(v => v && parseFloat(v) > 0).length >= 2;
    if (!hasDims) { updateBatchForm(tempId, { error: 'Dimensions are required — please enter at least 2 of Width, Height, or Depth.' }); return; }

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
      category: form.category.trim() || undefined,
      currency: form.currency || undefined,
      // New variant-aware fields
      variantId: form.variantId || undefined,
      sku: form.sku || undefined,
      activeVariant: form.activeVariant || undefined,
      images: form.images || (form.imageUrl.trim() ? { primary: form.imageUrl.trim() } : undefined),
      pricing: form.pricing || undefined,
      availableOptions: form.availableOptions || undefined,
      features: form.features && form.features.length > 0 ? form.features : undefined,
      materials: form.materials || (form.material.trim() ? { primary: form.material.trim() } : undefined),
      promotions: form.promotions && form.promotions.length > 0 ? form.promotions : undefined,
      shipping: form.shipping || undefined,
      availability: form.availability || undefined,
      // Legacy fields
      price: form.price ? parseFloat(form.price) : undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      productUrl: form.productUrl.trim() || undefined,
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
    const hasDims = [dimWidth, dimHeight, dimDepth].filter(v => v && parseFloat(v) > 0).length >= 2;
    if (!hasDims) { setError('Dimensions are required — please enter at least 2 of Width, Height, or Depth.'); return; }

    setLoading(true);
    setError('');
    setImageUrlWarning(false);

    const dimensions = (dimLength || dimWidth || dimHeight || dimDepth)
      ? { length: dimLength ? parseFloat(dimLength) : undefined, width: dimWidth ? parseFloat(dimWidth) : undefined, height: dimHeight ? parseFloat(dimHeight) : undefined, depth: dimDepth ? parseFloat(dimDepth) : undefined, unit: dimUnit }
      : undefined;

    const payload: ProductPayload = {
      productName: productName.trim(), sourceUrl: sourceUrl.trim(),
      brandName: brandName.trim() || undefined,
      category: category.trim() || undefined,
      currency: currency || undefined,
      // New variant-aware fields
      variantId: singleVariantId || undefined,
      sku: singleSku || undefined,
      activeVariant: singleActiveVariant || undefined,
      images: singleImages || (imageUrl.trim() ? { primary: imageUrl.trim() } : undefined),
      pricing: singlePricing || undefined,
      availableOptions: singleAvailableOptions || undefined,
      features: singleFeatures && singleFeatures.length > 0 ? singleFeatures : undefined,
      materials: singleMaterials || (material.trim() ? { primary: material.trim() } : undefined),
      promotions: singlePromotions && singlePromotions.length > 0 ? singlePromotions : undefined,
      shipping: singleShipping || undefined,
      availability: singleAvailability || undefined,
      // Legacy fields
      price: price ? parseFloat(price) : undefined,
      imageUrl: imageUrl.trim() || undefined, productUrl: productUrl.trim() || undefined,
      material: material.trim() || undefined,
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

            {/* ── Product hero: image + basic info (Amazon-style) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: imageUrl ? '200px 1fr' : '1fr', gap: 24, marginBottom: 24 }}>
              {/* Image preview */}
              {imageUrl && (
                <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-input)', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={imageUrl} alt="Product preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}

              <div>
                {/* Brand */}
                {brandName && <div style={{ fontSize: 12, color: '#3850be', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{brandName}</div>}

                {/* Product name */}
                <input
                  className="input-field"
                  type="text"
                  placeholder="Product Name *"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  style={{ fontSize: 18, fontWeight: 700, border: 'none', padding: '0 0 8px', background: 'none', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
                />

                {/* Category */}
                {category && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>{category}</div>}

                {/* Price display — large */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                    {price ? `$${parseFloat(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                  </span>
                  {singlePricing && singlePricing.length > 1 && (() => {
                    const prices = singlePricing.map(e => Number(e.price)).filter(n => !isNaN(n) && n > 0);
                    const min = Math.min(...prices);
                    const max = Math.max(...prices);
                    return min !== max ? (
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                        ${min.toLocaleString()} – ${max.toLocaleString()} across {singlePricing.length} variants
                      </span>
                    ) : null;
                  })()}
                </div>

                {/* Badges row: promotions, shipping, availability */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {singlePromotions?.map((p, i) => (
                    <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(220,170,50,0.12)', color: '#b8860b', fontWeight: 600 }}>{p}</span>
                  ))}
                  {singleShipping && (
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(34,139,34,0.1)', color: '#228b22', fontWeight: 600 }}>{singleShipping}</span>
                  )}
                  {singleAvailability && (
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(34,139,34,0.1)', color: '#228b22', fontWeight: 600 }}>{singleAvailability}</span>
                  )}
                  {leadTime && (
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(50,80,190,0.08)', color: '#3850be', fontWeight: 600 }}>{leadTime}</span>
                  )}
                </div>

                {singleSku && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>SKU: {singleSku}</div>}
              </div>
            </div>

            {/* ── Variant selectors (Amazon-style chips) ── */}
            {singleAvailableOptions && singleAvailableOptions.length > 0 && (
              <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 14 }}>
                  Select Variant
                </div>

                {singleAvailableOptions.map((option) => {
                  // Determine which value is currently selected from activeVariant
                  const optKey = option.type.toLowerCase();
                  const currentSelection = singleActiveVariant
                    ? String(singleActiveVariant[optKey] ?? singleActiveVariant[option.type] ?? '')
                    : '';

                  return (
                    <div key={option.type} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                        {option.type}: <span style={{ fontWeight: 700 }}>{currentSelection || 'Not selected'}</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {option.values.map((val) => {
                          const isSelected = currentSelection.toUpperCase() === val.toUpperCase();
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => {
                                // Update activeVariant with new selection
                                const updatedVariant = { ...(singleActiveVariant || {}) };
                                // Try both lowercase and original case keys
                                if (optKey in updatedVariant) updatedVariant[optKey] = val;
                                else if (option.type in updatedVariant) updatedVariant[option.type] = val;
                                else updatedVariant[optKey] = val;

                                // Find matching price from pricing matrix
                                if (singlePricing && singlePricing.length > 1) {
                                  const match = singlePricing.find(entry => {
                                    return Object.entries(updatedVariant).every(([k, v]) => {
                                      if (k === 'price') return true;
                                      const entryVal = entry[k] ?? entry[k.charAt(0).toUpperCase() + k.slice(1)];
                                      return !entryVal || String(entryVal).toUpperCase() === String(v).toUpperCase();
                                    });
                                  });
                                  if (match?.price != null) {
                                    updatedVariant.price = Number(match.price);
                                    setPrice(String(match.price));
                                  }
                                }

                                setSingleActiveVariant(updatedVariant);
                              }}
                              style={{
                                padding: '7px 16px',
                                borderRadius: 8,
                                fontSize: 12.5,
                                fontWeight: isSelected ? 700 : 500,
                                cursor: 'pointer',
                                transition: 'all 0.12s',
                                border: isSelected ? '2px solid var(--gold)' : '1px solid var(--border-strong)',
                                background: isSelected ? 'rgba(168,113,10,0.06)' : 'var(--bg-card)',
                                color: isSelected ? 'var(--gold)' : 'var(--text-secondary)',
                                boxShadow: isSelected ? '0 0 0 1px var(--gold)' : 'none',
                              }}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Features ── */}
            {singleFeatures && singleFeatures.length > 0 && (
              <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                  About this item
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {singleFeatures.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            )}

            {/* ── Materials ── */}
            {singleMaterials && Object.keys(singleMaterials).length > 0 && (
              <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                  Materials & Construction
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {Object.entries(singleMaterials).map(([key, val]) => (
                    <div key={key} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-input)', fontSize: 12.5 }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{key.replace(/_/g, ' ')}</div>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{Array.isArray(val) ? val.join(', ') : val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Pricing matrix table (collapsible) ── */}
            {/* Hide when the table adds no info beyond variant chips (single axis, all same price) */}
            {singlePricing && singlePricing.length > 1 && (() => {
              const nonPriceKeys = Object.keys(singlePricing[0]).filter(k => k !== 'price');
              const prices = singlePricing.map(e => Number(e.price)).filter(n => !isNaN(n));
              const allSamePrice = prices.length > 0 && prices.every(p => p === prices[0]);
              // If only 1 option axis and all prices identical, variant chips already show everything
              if (nonPriceKeys.length <= 1 && allSamePrice) return null;
              return true;
            })() && (
              <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>All Variants & Pricing</div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{singlePricing.length}</span>
                </div>
                <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-input)' }}>
                        {Object.keys(singlePricing[0]).filter(k => k !== 'price').map(k => (
                          <th key={k} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }}>{k}</th>
                        ))}
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }}>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {singlePricing.map((entry, i) => {
                        // Check if this row matches the current active variant
                        const isActive = singleActiveVariant && Object.entries(entry).every(([k, v]) => {
                          if (k === 'price') return true;
                          const av = singleActiveVariant[k] ?? singleActiveVariant[k.toLowerCase()];
                          return av != null && String(av).toUpperCase() === String(v).toUpperCase();
                        });
                        return (
                          <tr
                            key={i}
                            onClick={() => {
                              const newVariant: Record<string, string | number> = {};
                              for (const [k, v] of Object.entries(entry)) newVariant[k] = v;
                              setSingleActiveVariant(newVariant);
                              if (entry.price != null) setPrice(String(entry.price));
                            }}
                            style={{
                              cursor: 'pointer',
                              background: isActive ? 'rgba(168,113,10,0.06)' : i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                              borderLeft: isActive ? '3px solid var(--gold)' : '3px solid transparent',
                              transition: 'all 0.1s',
                            }}
                            onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(0,0,0,0.03)'; }}
                            onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)'; }}
                          >
                            {Object.entries(entry).filter(([k]) => k !== 'price').map(([k, v]) => (
                              <td key={k} style={{ padding: '8px 12px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', fontWeight: isActive ? 600 : 400 }}>{String(v)}</td>
                            ))}
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: isActive ? 'var(--gold)' : 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>
                              ${Number(entry.price).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Editable fields ── */}
            <SectionHeading>Edit Details</SectionHeading>

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
            <Field label="Image URL" optional><input className="input-field" type="url" placeholder="https://images.vendor.com/product.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} /></Field>
            <Field label="Product Page URL" optional><input className="input-field" type="url" placeholder="https://vendor.com/product" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} /></Field>

            <SectionHeading>Dimensions *</SectionHeading>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, marginTop: -8 }}>
              At least 2 of Width, Height, or Depth required
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 90px', gap: 12 }}>
              <Field label="Length" optional><input className="input-field" type="number" placeholder="0" min="0" step="0.1" value={dimLength} onChange={(e) => setDimLength(e.target.value)} /></Field>
              <Field label="Width"><input className="input-field" type="number" placeholder="0" min="0" step="0.1" value={dimWidth} onChange={(e) => setDimWidth(e.target.value)} /></Field>
              <Field label="Height"><input className="input-field" type="number" placeholder="0" min="0" step="0.1" value={dimHeight} onChange={(e) => setDimHeight(e.target.value)} /></Field>
              <Field label="Depth"><input className="input-field" type="number" placeholder="0" min="0" step="0.1" value={dimDepth} onChange={(e) => setDimDepth(e.target.value)} /></Field>
              <Field label="Unit"><select className="select-field" value={dimUnit} onChange={(e) => setDimUnit(e.target.value as 'in' | 'cm' | 'ft')}><option value="in">in</option><option value="cm">cm</option><option value="ft">ft</option></select></Field>
            </div>

            <Field label="Lead Time" optional><input className="input-field" type="text" placeholder="e.g. 4-6 weeks" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} /></Field>

            {/* AI-extracted metadata — editable */}
            {singleMetadata && Object.keys(singleMetadata).length > 0 && (
              <>
                <SectionHeading>Product Details</SectionHeading>
                <MetadataForm
                  metadata={singleMetadata}
                  onChange={(updated) => setSingleMetadata(updated)}
                  disabled={loading}
                />
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
