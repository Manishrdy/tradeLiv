'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, Product, ProjectSummary, Room, RecommendationResult, deriveAvailableOptions, ProductVariant } from '@/lib/api';
import {
  getAttributesForCategory,
  resolveAttributeValue,
  type AttributeConfig,
} from '@/lib/categoryAttributeConfig';
import {
  calculateFit,
  autoLayoutProducts,
  type FitResult,
  type FitStatus,
  type PlacedProduct,
  type LayoutItem,
} from '@/lib/roomFitEngine';
import RoomCanvas from '@/components/RoomCanvas';

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

const currFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function getImageUrl(p: Product): string | undefined {
  const imgs = p.images as { primary?: string } | null;
  return imgs?.primary || p.imageUrl || undefined;
}

function getDisplayPrice(p: Product, selectedVariant?: Record<string, string>): number | null {
  // Look up price from variants[] by matching options
  if (selectedVariant && p.variants && p.variants.length > 0) {
    const match = p.variants.find((v) =>
      Object.entries(selectedVariant).every(
        ([k, val]) => {
          const vVal = v.options[k] ?? v.options[k.charAt(0).toUpperCase() + k.slice(1)];
          return !vVal || vVal.toLowerCase() === val.toLowerCase();
        },
      ),
    );
    if (match) return match.price;
  }
  // Fallback to first variant
  if (p.variants && p.variants.length > 0) return p.variants[0].price;
  // Legacy fallback
  if (p.activeVariant?.price != null) return Number(p.activeVariant.price);
  return p.price;
}

function formatPriceRange(p: Product): string {
  if (p.variants && p.variants.length > 1) {
    const prices = p.variants.map((v) => v.price).filter((n) => n > 0);
    if (prices.length > 1) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (min !== max) return `${currFmt.format(min)} – ${currFmt.format(max)}`;
    }
  }
  const dp = getDisplayPrice(p);
  return dp != null ? currFmt.format(dp) : '—';
}

function nonEmptyText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function nonEmptyList(values: string[] | null | undefined): string[] {
  if (!values) return [];
  return values
    .map((value) => nonEmptyText(value))
    .filter((value): value is string => value != null);
}

/* ─── Completeness scoring ─────────────────────────── */

interface CompletenessResult {
  score: number;
  filled: number;
  total: number;
  label: string;
  color: string;
  bgColor: string;
}

function computeCompleteness(product: Product, attributes: AttributeConfig[]): CompletenessResult {
  const coreFields = [
    product.productName,
    product.brandName,
    getDisplayPrice(product),
    product.dimensions,
    product.material || product.materials,
  ];

  const coreFilled = coreFields.filter((v) => v != null && v !== '').length;
  const attrFilled = attributes.filter((attr) => {
    const { value } = resolveAttributeValue(product, attr);
    return value != null;
  }).length;

  const total = coreFields.length + attributes.length;
  const filled = coreFilled + attrFilled;
  const score = total > 0 ? Math.round((filled / total) * 100) : 0;

  if (score >= 80) return { score, filled, total, label: 'Complete', color: '#2C6347', bgColor: 'rgba(44,99,71,0.07)' };
  if (score >= 50) return { score, filled, total, label: 'Partial data', color: '#92700C', bgColor: 'rgba(146,112,12,0.07)' };
  return { score, filled, total, label: 'Limited data', color: '#b91c1c', bgColor: 'rgba(185,28,28,0.06)' };
}

/* ─── Cell state component ─────────────────────────── */

function CellValue({ value, uncertain }: { value: string | null; uncertain: boolean }) {
  if (value == null) {
    return (
      <span style={{ color: 'var(--text-placeholder)', fontStyle: 'italic', fontSize: 12 }}>
        Not listed
      </span>
    );
  }
  return (
    <span style={{ fontSize: 12.5, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {value}
      {uncertain && (
        <span title="Extracted by AI — verify on brand site" style={{ cursor: 'help', display: 'inline-flex', alignItems: 'center' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#92700C" strokeWidth="2" strokeLinecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
      )}
    </span>
  );
}

/* ─── Variant selector ─────────────────────────────── */

function VariantSelector({ product, selected, onChange }: {
  product: Product;
  selected: Record<string, string>;
  onChange: (sel: Record<string, string>) => void;
}) {
  const options = deriveAvailableOptions(product.variants);
  if (options.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {options.map((opt) => (
        <div key={opt.type}>
          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {opt.type}
          </label>
          <select
            value={selected[opt.type] || ''}
            onChange={(e) => onChange({ ...selected, [opt.type]: e.target.value })}
            className="input-field"
            style={{ fontSize: 11.5, padding: '4px 8px', marginTop: 2, width: '100%' }}
          >
            <option value="">All</option>
            {opt.values.map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>
        </div>
      ))}
    </div>
  );
}

/* ─── Price delta badge ────────────────────────────── */

function PriceDelta({ currentPrice, pinnedPrice }: { currentPrice: number | null; pinnedPrice: number | null }) {
  if (currentPrice == null || pinnedPrice == null || currentPrice === pinnedPrice) return null;
  const diff = currentPrice - pinnedPrice;
  const isNeg = diff < 0;
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700,
      color: isNeg ? '#2C6347' : '#b91c1c',
      background: isNeg ? 'rgba(44,99,71,0.07)' : 'rgba(185,28,28,0.06)',
      padding: '2px 7px', borderRadius: 999, marginLeft: 6,
    }}>
      {isNeg ? '−' : '+'}{currFmt.format(Math.abs(diff))} vs pinned
    </span>
  );
}

/* ─── Fit indicator badge (for comparison table) ──── */

const FIT_BADGE: Record<FitStatus, { color: string; bg: string; icon: string }> = {
  green: { color: '#2C6347', bg: 'rgba(44,99,71,0.07)', icon: '✓' },
  yellow: { color: '#92700C', bg: 'rgba(146,112,12,0.07)', icon: '⚠' },
  red: { color: '#b91c1c', bg: 'rgba(185,28,28,0.06)', icon: '✕' },
  unknown: { color: '#969696', bg: 'rgba(0,0,0,0.04)', icon: '?' },
};

function FitBadge({ fit }: { fit: FitResult }) {
  const badge = FIT_BADGE[fit.status];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
        color: badge.color, background: badge.bg, whiteSpace: 'nowrap',
      }}>
        {badge.icon} {fit.label}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        {fit.detail}
      </span>
    </div>
  );
}

/* ─── Missing Dimensions Modal ─────────────────────── */

interface DimFormEntry {
  productId: string;
  productName: string;
  brandName: string | null;
  imageUrl: string | undefined;
  width: string;
  depth: string;
  height: string;
  unit: string;
  /** Which fields were already present */
  hadWidth: boolean;
  hadDepth: boolean;
  hadHeight: boolean;
}

function MissingDimsModal({
  products,
  saving,
  onSave,
  onCancel,
}: {
  products: Product[];
  saving: boolean;
  onSave: (entries: DimFormEntry[]) => void;
  onCancel: () => void;
}) {
  const [entries, setEntries] = useState<DimFormEntry[]>(() =>
    products.map((p) => {
      const d = p.dimensions;
      const imgs = p.images as { primary?: string } | null;
      return {
        productId: p.id,
        productName: p.productName,
        brandName: p.brandName,
        imageUrl: imgs?.primary || p.imageUrl || undefined,
        width: d?.width != null && d.width > 0 ? String(d.width) : '',
        depth: d?.depth != null && d.depth > 0 ? String(d.depth) : d?.length != null && d.length > 0 ? String(d.length) : '',
        height: d?.height != null && d.height > 0 ? String(d.height) : '',
        unit: d?.unit || 'in',
        hadWidth: d?.width != null && d.width > 0,
        hadDepth: (d?.depth != null && d.depth > 0) || (d?.length != null && d.length > 0),
        hadHeight: d?.height != null && d.height > 0,
      };
    }),
  );

  const updateEntry = (idx: number, field: keyof DimFormEntry, value: string) => {
    setEntries((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const allValid = entries.every((e) => {
    const w = parseFloat(e.width);
    const d = parseFloat(e.depth);
    return !isNaN(w) && w > 0 && !isNaN(d) && d > 0;
  });

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        className="anim-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 640,
          maxHeight: '85vh', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: '28px 32px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, background: 'rgba(146,112,12,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92700C" strokeWidth="2" strokeLinecap="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              Missing Product Dimensions
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Enter width and depth to place {products.length === 1 ? 'this product' : 'these products'} in the room layout.
            </p>
          </div>
        </div>

        {/* Product dimension forms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
          {entries.map((entry, idx) => (
            <div
              key={entry.productId}
              style={{
                display: 'flex', gap: 14, padding: '14px 16px',
                borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-input)',
              }}
            >
              {/* Product thumbnail */}
              <div style={{
                width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
                background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {entry.imageUrl ? (
                  <img src={entry.imageUrl} alt={entry.productName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4">
                    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                  </svg>
                )}
              </div>

              {/* Product info + inputs */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.productName}
                </div>
                {entry.brandName && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{entry.brandName}</div>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  {/* Width */}
                  <div style={{ flex: 1, minWidth: 80 }}>
                    <label style={{ fontSize: 10, fontWeight: 600, color: entry.hadWidth ? 'var(--text-muted)' : '#92700C', display: 'block', marginBottom: 3 }}>
                      Width {!entry.hadWidth && <span style={{ color: '#b91c1c' }}>*</span>}
                    </label>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="e.g. 60"
                      value={entry.width}
                      onChange={(e) => updateEntry(idx, 'width', e.target.value)}
                      min="0"
                      step="0.1"
                      style={{
                        width: '100%', fontSize: 13, padding: '6px 10px',
                        borderColor: !entry.hadWidth && !entry.width ? 'rgba(185,28,28,0.3)' : undefined,
                      }}
                    />
                  </div>

                  {/* Depth */}
                  <div style={{ flex: 1, minWidth: 80 }}>
                    <label style={{ fontSize: 10, fontWeight: 600, color: entry.hadDepth ? 'var(--text-muted)' : '#92700C', display: 'block', marginBottom: 3 }}>
                      Depth {!entry.hadDepth && <span style={{ color: '#b91c1c' }}>*</span>}
                    </label>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="e.g. 36"
                      value={entry.depth}
                      onChange={(e) => updateEntry(idx, 'depth', e.target.value)}
                      min="0"
                      step="0.1"
                      style={{
                        width: '100%', fontSize: 13, padding: '6px 10px',
                        borderColor: !entry.hadDepth && !entry.depth ? 'rgba(185,28,28,0.3)' : undefined,
                      }}
                    />
                  </div>

                  {/* Height (optional) */}
                  <div style={{ flex: 1, minWidth: 80 }}>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                      Height
                    </label>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="optional"
                      value={entry.height}
                      onChange={(e) => updateEntry(idx, 'height', e.target.value)}
                      min="0"
                      step="0.1"
                      style={{ width: '100%', fontSize: 13, padding: '6px 10px' }}
                    />
                  </div>

                  {/* Unit */}
                  <div style={{ width: 70 }}>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                      Unit
                    </label>
                    <select
                      className="input-field"
                      value={entry.unit}
                      onChange={(e) => updateEntry(idx, 'unit', e.target.value)}
                      style={{ width: '100%', fontSize: 12, padding: '6px 8px' }}
                    >
                      <option value="in">inches</option>
                      <option value="cm">cm</option>
                      <option value="ft">feet</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            onClick={onCancel}
            className="btn-ghost"
            style={{ fontSize: 13 }}
          >
            Skip for now
          </button>
          <button
            onClick={() => onSave(entries)}
            disabled={!allValid || saving}
            className="btn-primary"
            style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, opacity: !allValid || saving ? 0.6 : 1 }}
          >
            {saving ? (
              <>
                <svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
                Saving…
              </>
            ) : (
              'Save & Place in Room'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Compare Page
   ═══════════════════════════════════════════════════════ */

export default function ComparePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [variantSelections, setVariantSelections] = useState<Record<string, Record<string, string>>>({});

  // Layer 2 state
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const [rotatedProducts, setRotatedProducts] = useState<Set<string>>(new Set());
  const [hiddenProducts, setHiddenProducts] = useState<Set<string>>(new Set());
  const [positionOverrides, setPositionOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const [showDimsModal, setShowDimsModal] = useState(false);
  const [dimsSaving, setDimsSaving] = useState(false);

  // Layer 3 state
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [recGenerating, setRecGenerating] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [designerNotes, setDesignerNotes] = useState('');
  const [editedRec, setEditedRec] = useState<string | null>(null);
  const [editedTradeOffs, setEditedTradeOffs] = useState<string[] | null>(null);
  const [showRecPanel, setShowRecPanel] = useState(false);

  // Parse product IDs from URL query
  const productIds = useMemo(() => {
    const ids = searchParams.get('ids');
    return ids ? ids.split(',').filter(Boolean) : [];
  }, [searchParams]);

  const pinned = useMemo(() => {
    const p = searchParams.get('pinned');
    return p || null;
  }, [searchParams]);

  // URL may include projectId and roomId
  const urlProjectId = searchParams.get('projectId');
  const urlRoomId = searchParams.get('roomId');

  // Fetch products
  useEffect(() => {
    if (productIds.length < 2) {
      setLoading(false);
      setError('Select at least 2 products to compare.');
      return;
    }
    setLoading(true);
    api.quickCompare(productIds).then((res) => {
      if (res.data) {
        const map = new Map(res.data.products.map((p) => [p.id, p]));
        const ordered = productIds.map((id) => map.get(id)).filter(Boolean) as Product[];
        setProducts(ordered);
        setPinnedId(pinned || ordered[0]?.id || null);
      } else {
        setError(res.error || 'Failed to load products.');
      }
      setLoading(false);
    });
  }, [productIds, pinned]);

  // Fetch projects for room selector
  useEffect(() => {
    api.getProjects().then((res) => {
      if (res.data) {
        setProjects(res.data);
        if (urlProjectId) setSelectedProjectId(urlProjectId);
      }
    });
  }, [urlProjectId]);

  // Fetch project detail (rooms) when project selected
  useEffect(() => {
    if (!selectedProjectId) { setRooms([]); setSelectedRoomId(null); return; }
    api.getProject(selectedProjectId).then((res) => {
      if (res.data) {
        setRooms(res.data.rooms);
        if (urlRoomId && res.data.rooms.some((r) => r.id === urlRoomId)) {
          setSelectedRoomId(urlRoomId);
        } else if (res.data.rooms.length > 0) {
          setSelectedRoomId(res.data.rooms[0].id);
        }
      }
    });
  }, [selectedProjectId, urlRoomId]);

  // Derive category from pinned product
  const primaryCategory = useMemo(() => {
    const p = products.find((p) => p.id === pinnedId);
    return p?.category || products.find((p) => p.category)?.category || null;
  }, [products, pinnedId]);

  const attributes = useMemo(() => getAttributesForCategory(primaryCategory), [primaryCategory]);
  const visibleAttributes = useMemo(
    () => attributes.filter((attr) => products.some((p) => resolveAttributeValue(p, attr).value != null)),
    [attributes, products],
  );
  const hasFeaturesRow = useMemo(
    () => products.some((p) => nonEmptyList(p.features).length > 0),
    [products],
  );
  const hasFinishesRow = useMemo(
    () => products.some((p) => nonEmptyList(p.finishes).length > 0),
    [products],
  );

  const pinnedProduct = products.find((p) => p.id === pinnedId) || null;
  const pinnedPrice = pinnedProduct ? getDisplayPrice(pinnedProduct, variantSelections[pinnedProduct.id]) : null;

  // Selected room
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) || null;
  const hasRoomDims = selectedRoom && selectedRoom.widthFt && selectedRoom.lengthFt;

  // Detect products with missing dimensions (width or depth/length)
  const productsWithMissingDims = useMemo(() => {
    return products.filter((p) => {
      const d = p.dimensions;
      if (!d) return true;
      const hasWidth = d.width != null && d.width > 0;
      const hasDepth = (d.depth != null && d.depth > 0) || (d.length != null && d.length > 0);
      return !hasWidth || !hasDepth;
    });
  }, [products]);

  // Auto-show dimensions modal when room is selected and products have missing dims
  useEffect(() => {
    if (hasRoomDims && productsWithMissingDims.length > 0) {
      setShowDimsModal(true);
    }
  }, [hasRoomDims, productsWithMissingDims.length]);

  // Compute fit results per product
  const fitResults = useMemo<Record<string, FitResult>>(() => {
    if (!hasRoomDims) return {};
    const results: Record<string, FitResult> = {};
    for (const p of products) {
      results[p.id] = calculateFit(
        selectedRoom!.widthFt,
        selectedRoom!.lengthFt,
        p.dimensions,
        p.category,
      );
    }
    return results;
  }, [products, selectedRoom, hasRoomDims]);

  // Auto-layout products for canvas
  const placedProducts = useMemo<PlacedProduct[]>(() => {
    if (!hasRoomDims) return [];

    const compareItems: LayoutItem[] = products.map((p) => ({
      id: p.id,
      label: p.productName,
      brand: p.brandName,
      imageUrl: (p.images as { primary?: string } | null)?.primary || p.imageUrl || undefined,
      dims: p.dimensions,
      category: p.category,
      isContext: false,
      isHighlighted: highlightedProductId === p.id,
      rotated: rotatedProducts.has(p.id),
    }));

    const laid = autoLayoutProducts(
      Number(selectedRoom!.widthFt),
      Number(selectedRoom!.lengthFt),
      compareItems,
    );

    // Apply manual position overrides from drag-and-drop
    const roomW = Number(selectedRoom!.widthFt) * 12;
    const roomH = Number(selectedRoom!.lengthFt) * 12;
    return laid.map((p) => {
      const ov = positionOverrides[p.id];
      if (!ov) return p;
      const x = Math.max(0, Math.min(ov.x, roomW - p.widthIn));
      const y = Math.max(0, Math.min(ov.y, roomH - p.depthIn));
      return {
        ...p,
        x, y,
        clearance: {
          top: Math.round(y),
          left: Math.round(x),
          right: Math.round(roomW - x - p.widthIn),
          bottom: Math.round(roomH - y - p.depthIn),
        },
      };
    });
  }, [products, selectedRoom, hasRoomDims, highlightedProductId, rotatedProducts, positionOverrides]);

  const setPin = useCallback((id: string) => setPinnedId(id), []);

  const removeProduct = useCallback((id: string) => {
    const remaining = productIds.filter((pid) => pid !== id);
    if (remaining.length < 2) { router.push('/catalog'); return; }
    const newPinned = pinnedId === id ? remaining[0] : pinnedId;
    router.replace(`/compare?ids=${remaining.join(',')}&pinned=${newPinned}`);
  }, [productIds, pinnedId, router]);

  // Generate recommendation handler
  const handleGenerateRecommendation = useCallback(async () => {
    if (products.length < 2) return;
    setRecGenerating(true);
    setRecError(null);
    setRecommendation(null);
    setEditedRec(null);
    setEditedTradeOffs(null);

    const res = await api.generateRecommendation({
      productIds: products.map((p) => p.id),
      projectId: selectedProjectId || undefined,
      roomId: selectedRoomId || undefined,
      designerNotes: designerNotes.trim() || undefined,
    });

    if (res.data) {
      setRecommendation(res.data);
      setEditedRec(res.data.recommendation);
      setEditedTradeOffs([...res.data.tradeOffs]);
      setShowRecPanel(true);

      // Log event
      api.logComparisonEvent('recommendation_generated', {
        productIds: products.map((p) => p.id),
        recommendedProduct: res.data.recommendedProduct,
      });
    } else {
      setRecError(res.error || 'Failed to generate recommendation.');
    }
    setRecGenerating(false);
  }, [products, selectedProjectId, selectedRoomId, designerNotes]);

  // Discard recommendation
  const handleDiscardRec = useCallback(() => {
    if (recommendation) {
      api.logComparisonEvent('recommendation_discarded', {
        recommendedProduct: recommendation.recommendedProduct,
      });
    }
    setRecommendation(null);
    setShowRecPanel(false);
    setEditedRec(null);
    setEditedTradeOffs(null);
  }, [recommendation]);

  // Save missing dimensions handler
  const handleSaveDimensions = useCallback(async (entries: DimFormEntry[]) => {
    setDimsSaving(true);
    const updatedProducts = [...products];

    for (const entry of entries) {
      const w = parseFloat(entry.width);
      const d = parseFloat(entry.depth);
      if (isNaN(w) || w <= 0 || isNaN(d) || d <= 0) continue;

      const h = parseFloat(entry.height);
      const dims = {
        width: w,
        depth: d,
        ...((!isNaN(h) && h > 0) ? { height: h } : {}),
        unit: entry.unit as 'in' | 'cm' | 'ft',
      };

      const res = await api.updateProduct(entry.productId, { dimensions: dims });
      if (res.data) {
        // Update local product state with the saved dimensions
        const idx = updatedProducts.findIndex((p) => p.id === entry.productId);
        if (idx !== -1) {
          updatedProducts[idx] = { ...updatedProducts[idx], dimensions: dims };
        }
      }
    }

    setProducts(updatedProducts);
    setDimsSaving(false);
    setShowDimsModal(false);
  }, [products]);

  /* ─── Loading / Error ─────────────────────────────── */

  if (loading) {
    return (
      <div style={{ padding: '60px 44px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 14 }}>
        <svg className="anim-rotate" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
        Loading comparison…
      </div>
    );
  }

  if (error || products.length < 2) {
    return (
      <div style={{ padding: '80px 44px', textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          {error || 'Not enough products to compare'}
        </div>
        <Link href="/catalog">
          <button className="btn-ghost" style={{ marginTop: 12 }}>Back to Catalog</button>
        </Link>
      </div>
    );
  }

  /* ─── Render ──────────────────────────────────────── */

  const colWidth = `${Math.min(260, Math.floor(800 / products.length))}px`;

  return (
    <div style={{ padding: '32px 44px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Link href="/catalog" style={{ textDecoration: 'none', fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back to Catalog
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            Compare Products
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {products.length} products
            {primaryCategory && <span> · {primaryCategory}</span>}
          </p>
        </div>

        {/* Room context selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>
              Project
            </label>
            <select
              className="input-field"
              value={selectedProjectId || ''}
              onChange={(e) => { setSelectedProjectId(e.target.value || null); setSelectedRoomId(null); }}
              style={{ fontSize: 12, padding: '6px 10px', minWidth: 160 }}
            >
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {rooms.length > 0 && (
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>
                Room
              </label>
              <select
                className="input-field"
                value={selectedRoomId || ''}
                onChange={(e) => setSelectedRoomId(e.target.value || null)}
                style={{ fontSize: 12, padding: '6px 10px', minWidth: 140 }}
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.widthFt && r.lengthFt ? `(${r.widthFt}×${r.lengthFt} ft)` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── Room Canvas (Layer 2) ──────────────────── */}
      {hasRoomDims && (
        <div style={{ marginBottom: 24 }} className="anim-fade-up">
          <RoomCanvas
            roomWidthFt={Number(selectedRoom!.widthFt)}
            roomLengthFt={Number(selectedRoom!.lengthFt)}
            roomName={selectedRoom!.name}
            products={placedProducts}
            highlightedId={highlightedProductId}
            hiddenIds={hiddenProducts}
            onProductClick={(id) => {
              if (products.some((p) => p.id === id)) {
                setHighlightedProductId((prev) => prev === id ? null : id);
              }
            }}
            onRotateProduct={(id) => {
              setRotatedProducts((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
              });
            }}
            onToggleVisibility={(id) => {
              setHiddenProducts((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
              });
            }}
            onProductMove={(id, xIn, yIn) => {
              setPositionOverrides((prev) => ({ ...prev, [id]: { x: xIn, y: yIn } }));
            }}
          />
          {/* Room context note */}
        </div>
      )}

      {/* No room selected prompt */}
      {!hasRoomDims && selectedProjectId && selectedRoomId && (
        <div style={{
          marginBottom: 24, padding: '20px 24px', borderRadius: 12,
          border: '1px dashed var(--border-strong)', background: 'var(--bg-input)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Room dimensions not set
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Add width and length to this room to see the 2D layout preview.
          </div>
        </div>
      )}

      {!selectedProjectId && (
        <div style={{
          marginBottom: 24, padding: '20px 24px', borderRadius: 12,
          border: '1px dashed var(--border-strong)', background: 'var(--bg-input)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Select a project to see the room layout
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              The 2D floor plan shows how each product fits proportionally in the actual room.
            </div>
          </div>
        </div>
      )}

      {/* ── Comparison Table ───────────────────────── */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: products.length * 220 + 160 }}>
          <colgroup>
            <col style={{ width: 160 }} />
            {products.map((p) => (<col key={p.id} style={{ width: colWidth }} />))}
          </colgroup>

          {/* ── Product header row ───────────────────── */}
          <thead>
            <tr>
              <th style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-input)', textAlign: 'left', verticalAlign: 'top' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Attribute
                </span>
              </th>
              {products.map((p) => {
                const isPinned = p.id === pinnedId;
                const completeness = computeCompleteness(p, attributes);
                const isHl = highlightedProductId === p.id;
                return (
                  <th
                    key={p.id}
                    onClick={() => setHighlightedProductId((prev) => prev === p.id ? null : p.id)}
                    style={{
                      padding: '14px 14px 12px',
                      borderBottom: '1px solid var(--border)',
                      borderLeft: '1px solid var(--border)',
                      background: isHl ? 'rgba(37,99,235,0.04)' : isPinned ? 'rgba(158,124,63,0.04)' : 'var(--bg-card)',
                      textAlign: 'center', verticalAlign: 'top', position: 'relative',
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                  >
                    {isPinned && (
                      <div style={{
                        position: 'absolute', top: 8, left: 8,
                        fontSize: 9, fontWeight: 700, color: 'var(--gold)',
                        background: 'var(--gold-dim)', border: '1px solid var(--gold-border)',
                        padding: '2px 7px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        Pinned
                      </div>
                    )}

                    <div style={{
                      width: 80, height: 80, borderRadius: 8, margin: '0 auto 8px',
                      background: 'var(--bg-input)', overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      outline: isHl ? '2px solid #2563eb' : 'none', outlineOffset: -1,
                    }}>
                      {getImageUrl(p) ? (
                        <img src={getImageUrl(p)} alt={p.productName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4">
                          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                        </svg>
                      )}
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2, lineHeight: 1.3 }}>
                      {p.productName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                      {p.brandName || '—'}
                    </div>

                    <span style={{
                      display: 'inline-block', fontSize: 10, fontWeight: 600,
                      padding: '2px 8px', borderRadius: 999,
                      color: completeness.color, background: completeness.bgColor,
                    }}>
                      {completeness.label} ({completeness.score}%)
                    </span>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                      {!isPinned && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setPin(p.id); }}
                          style={{
                            fontSize: 10, fontWeight: 600, padding: '3px 10px',
                            borderRadius: 6, border: '1px solid var(--border)',
                            background: 'transparent', color: 'var(--text-muted)',
                            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                          Set as Pinned
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeProduct(p.id); }}
                        style={{
                          fontSize: 10, fontWeight: 600, padding: '3px 10px',
                          borderRadius: 6, border: '1px solid var(--border)',
                          background: 'transparent', color: 'var(--text-muted)',
                          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#b91c1c'; e.currentTarget.style.color = '#b91c1c'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                      >
                        Remove
                      </button>
                    </div>

                    {(p.sourceUrl || p.productUrl) && (
                      <a
                        href={p.productUrl || p.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          fontSize: 10, color: 'var(--text-muted)', marginTop: 8, textDecoration: 'none',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        View on brand site
                      </a>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {/* ── Room Fit row (Layer 2) ─────────────── */}
            {hasRoomDims && (
              <tr>
                <td style={rowLabelStyle}>
                  <span style={labelTextStyle}>Room Fit</span>
                  <div style={{ fontSize: 9.5, color: 'var(--text-placeholder)', marginTop: 2, whiteSpace: 'normal' }}>
                    {selectedRoom!.name}
                  </div>
                </td>
                {products.map((p) => {
                  const fit = fitResults[p.id];
                  return (
                    <td key={p.id} style={cellStyle(p.id === pinnedId)}>
                      {fit ? <FitBadge fit={fit} /> : <CellValue value={null} uncertain={false} />}
                    </td>
                  );
                })}
              </tr>
            )}

            {/* ── Variant selector row ─────────────────── */}
            {products.some((p) => p.variants && p.variants.length > 1) && (
              <tr>
                <td style={rowLabelStyle}><span style={labelTextStyle}>Variants</span></td>
                {products.map((p) => (
                  <td key={p.id} style={cellStyle(p.id === pinnedId)}>
                    <VariantSelector
                      product={p}
                      selected={variantSelections[p.id] || {}}
                      onChange={(sel) => setVariantSelections((prev) => ({ ...prev, [p.id]: sel }))}
                    />
                    {(!p.variants || p.variants.length <= 1) && (
                      <span style={{ fontSize: 11, color: 'var(--text-placeholder)', fontStyle: 'italic' }}>Single variant</span>
                    )}
                  </td>
                ))}
              </tr>
            )}

            {/* ── Price row ────────────────────────────── */}
            <tr>
              <td style={rowLabelStyle}><span style={labelTextStyle}>Price</span></td>
              {products.map((p) => {
                const sel = variantSelections[p.id] || {};
                const hasSelection = Object.values(sel).some((v) => v !== '');
                const price = getDisplayPrice(p, hasSelection ? sel : undefined);
                const isPinned = p.id === pinnedId;
                return (
                  <td key={p.id} style={cellStyle(isPinned)}>
                    <div>
                      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                        {hasSelection && price != null ? currFmt.format(price) : formatPriceRange(p)}
                      </span>
                      {!isPinned && <PriceDelta currentPrice={price} pinnedPrice={pinnedPrice} />}
                    </div>
                    {hasSelection && price == null && p.variants && p.variants.length > 0 && (
                      <div style={{ fontSize: 10, color: '#92700C', marginTop: 4, lineHeight: 1.3 }}>
                        Price shown for base configuration. Variant pricing may differ — verify on brand site.
                      </div>
                    )}
                    {(!p.variants || p.variants.length === 0) && p.price != null && (
                      <div style={{ fontSize: 10, color: 'var(--text-placeholder)', marginTop: 2 }}>Base price only</div>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* ── Category + common attribute rows ───── */}
            {visibleAttributes.map((attr) => (
              <tr key={attr.key}>
                <td style={rowLabelStyle}><span style={labelTextStyle}>{attr.label}</span></td>
                {products.map((p) => {
                  const { value, uncertain } = resolveAttributeValue(p, attr);
                  return (
                    <td key={p.id} style={cellStyle(p.id === pinnedId)}>
                      <CellValue value={value} uncertain={uncertain} />
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* ── Features row ─────────────────────────── */}
            {hasFeaturesRow && (
            <tr>
              <td style={rowLabelStyle}><span style={labelTextStyle}>Features</span></td>
              {products.map((p) => (
                <td key={p.id} style={cellStyle(p.id === pinnedId)}>
                  {(() => {
                    const features = nonEmptyList(p.features);
                    return features.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {features.slice(0, 5).map((f, i) => (<li key={i}>{f}</li>))}
                      {features.length > 5 && (
                        <li style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>+{features.length - 5} more</li>
                      )}
                    </ul>
                    ) : (
                    <CellValue value={null} uncertain={false} />
                    );
                  })()}
                </td>
              ))}
            </tr>
            )}

            {/* ── Finishes row ─────────────────────────── */}
            {hasFinishesRow && (
            <tr>
              <td style={rowLabelStyle}><span style={labelTextStyle}>Finishes</span></td>
              {products.map((p) => (
                <td key={p.id} style={cellStyle(p.id === pinnedId)}>
                  {(() => {
                    const finishes = nonEmptyList(p.finishes);
                    return finishes.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {finishes.map((f, i) => (
                        <span key={i} style={{
                          fontSize: 10.5, padding: '2px 8px', borderRadius: 999,
                          background: 'var(--bg-input)', border: '1px solid var(--border)',
                          color: 'var(--text-secondary)', fontWeight: 500,
                        }}>
                          {f}
                        </span>
                      ))}
                    </div>
                    ) : (
                    <CellValue value={null} uncertain={false} />
                    );
                  })()}
                </td>
              ))}
            </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Layer 3: AI Recommendation ─────────────── */}
      <div style={{ marginTop: 24 }}>
        {/* Designer notes + generate button */}
        {!showRecPanel && (
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 12,
            padding: '20px 24px', borderRadius: 12,
            border: '1px solid var(--border)', background: 'var(--bg-card)',
          }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Designer notes (optional, not shared with client)
              </label>
              <textarea
                className="input-field"
                placeholder="Add context for the AI — e.g., 'Client prefers lighter woods' or 'Budget is flexible for the right piece'…"
                value={designerNotes}
                onChange={(e) => setDesignerNotes(e.target.value)}
                rows={2}
                style={{ width: '100%', fontSize: 12, resize: 'vertical' }}
              />
            </div>
            <button
              onClick={handleGenerateRecommendation}
              disabled={recGenerating || products.length < 2}
              className="btn-primary"
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                whiteSpace: 'nowrap', flexShrink: 0,
                opacity: recGenerating ? 0.7 : 1,
              }}
            >
              {recGenerating ? (
                <>
                  <svg className="anim-rotate" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  Generate Recommendation
                </>
              )}
            </button>
          </div>
        )}

        {recError && (
          <div style={{
            marginTop: 12, padding: '12px 16px', borderRadius: 8,
            background: 'rgba(185,28,28,0.06)', border: '1px solid rgba(185,28,28,0.15)',
            fontSize: 12, color: '#b91c1c',
          }}>
            {recError}
          </div>
        )}

        {/* Recommendation panel */}
        {showRecPanel && recommendation && (
          <div className="anim-fade-up" style={{
            padding: '24px 28px', borderRadius: 12,
            border: '1px solid var(--gold-border)', background: 'var(--bg-card)',
          }}>
            {/* Panel header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  AI Recommendation
                </span>
                {recommendation.recommendedProduct && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                    background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid var(--gold-border)',
                  }}>
                    Best fit: {recommendation.recommendedProduct}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleGenerateRecommendation}
                  disabled={recGenerating}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: '5px 12px',
                    borderRadius: 6, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text-muted)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {recGenerating ? 'Regenerating…' : 'Regenerate'}
                </button>
                <button
                  onClick={handleDiscardRec}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: '5px 12px',
                    borderRadius: 6, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text-muted)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Discard
                </button>
              </div>
            </div>

            {/* Recommendation summary (editable) */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Recommendation Summary
              </div>
              <textarea
                value={editedRec || ''}
                onChange={(e) => {
                  setEditedRec(e.target.value);
                  api.logComparisonEvent('recommendation_edited', {
                    recommendedProduct: recommendation.recommendedProduct,
                    field: 'recommendation',
                  });
                }}
                rows={4}
                className="input-field"
                style={{ width: '100%', fontSize: 13, lineHeight: 1.6, resize: 'vertical' }}
              />
              <div style={{ fontSize: 10, color: 'var(--text-placeholder)', marginTop: 4 }}>
                Edit before sharing with your client. This text will be visible in the client portal.
              </div>
            </div>

            {/* Trade-offs (editable) */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Key Trade-offs
              </div>
              {(editedTradeOffs || []).map((to, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, flexShrink: 0 }}>•</span>
                  <input
                    value={to}
                    onChange={(e) => {
                      const next = [...(editedTradeOffs || [])];
                      next[i] = e.target.value;
                      setEditedTradeOffs(next);
                    }}
                    className="input-field"
                    style={{ flex: 1, fontSize: 12.5, padding: '4px 8px' }}
                  />
                </div>
              ))}
            </div>

            {/* Internal notes (designer only) */}
            {recommendation.internalNotes.length > 0 && (
              <div style={{
                padding: '14px 16px', borderRadius: 8,
                background: 'rgba(146,112,12,0.05)', border: '1px solid rgba(146,112,12,0.12)',
                marginBottom: 20,
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: '#92700C',
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  For Designer Only — Not Shared with Client
                </div>
                {recommendation.internalNotes.map((note, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#92700C', lineHeight: 1.5, marginBottom: 4 }}>
                    • {note}
                  </div>
                ))}
              </div>
            )}

            {/* Share with client button */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-primary"
                onClick={() => {
                  api.logComparisonEvent('recommendation_accepted', {
                    recommendedProduct: recommendation.recommendedProduct,
                    edited: editedRec !== recommendation.recommendation,
                  });
                  // TODO: In the future, this would save to shortlist sharedNotes and push to client portal
                  alert('Recommendation saved! In a future update, this will be shared with the client via the project portal.');
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M22 2L11 13" /><path d="M22 2L15 22 11 13 2 9l20-7z" />
                </svg>
                Share with Client
              </button>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
                Shares recommendation + trade-offs via client portal
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Missing Dimensions Modal ──────────────── */}
      {showDimsModal && productsWithMissingDims.length > 0 && (
        <MissingDimsModal
          products={productsWithMissingDims}
          saving={dimsSaving}
          onSave={handleSaveDimensions}
          onCancel={() => setShowDimsModal(false)}
        />
      )}
    </div>
  );
}

/* ─── Shared cell styles ──────────────────────────── */

const rowLabelStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg-input)',
  verticalAlign: 'top',
};

const labelTextStyle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
};

function cellStyle(isPinned: boolean): React.CSSProperties {
  return {
    padding: '10px 14px',
    borderBottom: '1px solid var(--border)',
    borderLeft: '1px solid var(--border)',
    background: isPinned ? 'rgba(158,124,63,0.03)' : 'transparent',
    verticalAlign: 'top',
  };
}
