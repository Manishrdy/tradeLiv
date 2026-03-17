'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ProductPayload, ExtractedProduct, DuplicateProduct } from '@/lib/api';

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
  const [pickingProduct, setPickingProduct] = useState(false);
  const [imageUrlWarning, setImageUrlWarning] = useState(false);

  // Duplicate modal state
  const [duplicateProduct, setDuplicateProduct] = useState<DuplicateProduct | null>(null);

  // Rate limit state
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const rateLimitTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Form state
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
  const [dimUnit, setDimUnit] = useState<'in' | 'cm' | 'ft'>('in');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Cycle through extract steps while extracting
  useEffect(() => {
    if (!extracting) {
      setExtractStep(0);
      return;
    }
    const interval = setInterval(() => {
      setExtractStep((s) => Math.min(s + 1, EXTRACT_STEPS.length - 1));
    }, 7000);
    return () => clearInterval(interval);
  }, [extracting]);

  // Count down rate limit display
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    rateLimitTimer.current = setInterval(() => {
      setRateLimitSeconds((s) => {
        if (s <= 1) {
          if (rateLimitTimer.current) clearInterval(rateLimitTimer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (rateLimitTimer.current) clearInterval(rateLimitTimer.current); };
  }, [rateLimitSeconds]);

  function applyExtractedProduct(data: ExtractedProduct, url?: string) {
    if (url) setSourceUrl(url);
    setProductName(data.productName ?? '');
    setBrandName(data.brandName ?? '');
    setPrice(data.price != null ? String(data.price) : '');
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
      if (data.dimensions.unit) setDimUnit(data.dimensions.unit as 'in' | 'cm' | 'ft');
    }
    setExtracted(true);
    setCollectionProducts(null);
    setCollectionSearch('');
  }

  async function handleExtract() {
    if (!extractUrl.trim()) { setExtractError('Please enter a URL.'); return; }
    if (rateLimitSeconds > 0) return;

    setExtracting(true);
    setExtractError('');
    setCollectionProducts(null);
    setCollectionSearch('');
    setExtracted(false);
    setDuplicateProduct(null);

    const result = await api.extractProduct(extractUrl.trim());
    setExtracting(false);

    if (result.error) {
      // Pre-fill sourceUrl so the designer isn't starting from scratch
      if (!sourceUrl) setSourceUrl(extractUrl.trim());

      // Parse rate limit from error response
      const anyResult = result as any;
      if (anyResult.retryAfter) {
        setRateLimitSeconds(anyResult.retryAfter);
      }
      setExtractError(result.error);
      return;
    }

    const data = result.data!;

    // Duplicate — show modal
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

  async function handlePickProduct(product: ExtractedProduct) {
    // If the item has its own product URL, re-extract it for full details
    // (collection pages only return shallow data — no dimensions/material/finishes)
    const targetUrl = product.productUrl;
    if (targetUrl) {
      setPickingProduct(true);
      setExtractError('');
      const result = await api.extractProduct(targetUrl);
      setPickingProduct(false);
      if (result.error) {
        // Fall back to the shallow data we already have
        applyExtractedProduct(product, targetUrl);
        return;
      }
      const data = result.data!;
      if (data.type === 'single' && data.product) {
        applyExtractedProduct(data.product, targetUrl);
        return;
      }
    }
    // No productUrl or unexpected response — use shallow data as-is
    applyExtractedProduct(product, targetUrl || extractUrl.trim());
  }

  function addFinish() {
    const val = finishInput.trim();
    if (val && !finishes.includes(val)) {
      setFinishes([...finishes, val]);
    }
    setFinishInput('');
  }

  function removeFinish(f: string) {
    setFinishes(finishes.filter((x) => x !== f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim()) { setError('Product name is required.'); return; }
    if (!sourceUrl.trim()) { setError('Source URL is required.'); return; }

    setLoading(true);
    setError('');
    setImageUrlWarning(false);

    const dimensions = (dimLength || dimWidth || dimHeight)
      ? {
          length: dimLength ? parseFloat(dimLength) : undefined,
          width: dimWidth ? parseFloat(dimWidth) : undefined,
          height: dimHeight ? parseFloat(dimHeight) : undefined,
          unit: dimUnit,
        }
      : undefined;

    const payload: ProductPayload = {
      productName: productName.trim(),
      sourceUrl: sourceUrl.trim(),
      brandName: brandName.trim() || undefined,
      price: price ? parseFloat(price) : undefined,
      imageUrl: imageUrl.trim() || undefined,
      productUrl: productUrl.trim() || undefined,
      category: category.trim() || undefined,
      material: material.trim() || undefined,
      leadTime: leadTime.trim() || undefined,
      finishes: finishes.length > 0 ? finishes : undefined,
      dimensions,
    };

    const result = await api.createProduct(payload);
    setLoading(false);

    if (result.error) { setError(result.error); return; }

    // Check for image URL warning from server
    const anyResult = result.data as any;
    if (anyResult?.imageUrlWarning) {
      setImageUrlWarning(true);
      setImageUrl('');
      // Still navigates after a short pause so user sees the warning
      setTimeout(() => router.push(`/catalog/${anyResult.id}`), 2000);
      return;
    }

    router.push(`/catalog/${result.data!.id}`);
  }

  const filteredCollection = collectionProducts
    ? collectionSearch.trim()
      ? collectionProducts.filter((p) =>
          p.productName.toLowerCase().includes(collectionSearch.toLowerCase()) ||
          (p.brandName ?? '').toLowerCase().includes(collectionSearch.toLowerCase())
        )
      : collectionProducts
    : null;

  return (
    <div style={{ padding: '40px 44px', maxWidth: 680 }}>

      {/* ── Duplicate product modal ───────────────────── */}
      {duplicateProduct && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="card" style={{ width: 420, padding: '28px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
                background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {duplicateProduct.imageUrl ? (
                  <img src={duplicateProduct.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                  </svg>
                )}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Product already in catalog</div>
                {!duplicateProduct.isActive && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>This product is currently inactive</div>
                )}
              </div>
            </div>

            <div style={{
              padding: '12px 14px', borderRadius: 8, marginBottom: 20,
              background: 'var(--bg-input)', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{duplicateProduct.productName}</div>
              {duplicateProduct.brandName && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{duplicateProduct.brandName}</div>
              )}
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 22 }}>
              This URL is already saved in your catalog. You can view the existing product or dismiss to continue adding a new entry manually.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Link
                href={`/catalog/${duplicateProduct.id}`}
                className="btn-primary"
                style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}
              >
                View product
              </Link>
              <button
                className="btn-ghost"
                onClick={() => setDuplicateProduct(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Back + header ────────────────────────────────── */}
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

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.035em', marginBottom: 4 }}>
          Add a product
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Paste a product URL to auto-fill details, or enter them manually.
        </p>
      </div>

      {/* ── Extract from URL ─────────────────────────────── */}
      <div className="card" style={{ padding: '24px 28px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Auto-extract from URL
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
          Paste a product page link and we&apos;ll extract the name, price, dimensions, images, and more automatically.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            className="input-field"
            type="url"
            placeholder="https://vendor.com/product-page"
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
              <>
                <svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                Extracting…
              </>
            ) : rateLimitSeconds > 0 ? (
              `Wait ${rateLimitSeconds}s`
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
                Extract
              </>
            )}
          </button>
        </div>

        {/* Extraction progress */}
        {extracting && (
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 8,
            background: 'rgba(168,113,10,0.06)', border: '1px solid rgba(168,113,10,0.15)',
            fontSize: 12.5, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg className="anim-rotate" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
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
                <button
                  onClick={handleExtract}
                  style={{
                    flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, color: 'inherit', textDecoration: 'underline', padding: 0,
                  }}
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {/* Success banner */}
        {extracted && !collectionProducts && (
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 8,
            background: 'var(--green-dim)', border: '1px solid var(--green-border)',
            fontSize: 12.5, fontWeight: 600, color: 'var(--green)',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Product details extracted. Review and edit below, then save.
          </div>
        )}

        {/* Collection picker — multiple products found */}
        {filteredCollection !== null && collectionProducts && collectionProducts.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 12,
              background: 'rgba(50,80,190,0.06)', border: '1px solid rgba(50,80,190,0.15)',
              fontSize: 12.5, fontWeight: 600, color: '#3850be',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              </svg>
              Collection page — {collectionTotal} products found. Select one to extract.
            </div>

            {/* Collection search */}
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
                {filteredCollection.length} of {collectionProducts.length}
              </span>
            </div>

            {pickingProduct && (
              <div style={{
                marginBottom: 8, padding: '9px 14px', borderRadius: 8,
                background: 'rgba(168,113,10,0.06)', border: '1px solid rgba(168,113,10,0.15)',
                fontSize: 12.5, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <svg className="anim-rotate" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                Getting full product details…
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflow: 'auto' }}>
              {filteredCollection.length === 0 ? (
                <div style={{ padding: '14px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  No products match your filter.
                </div>
              ) : (
                filteredCollection.map((p, i) => (
                  <div
                    key={i}
                    onClick={() => { if (!pickingProduct) handlePickProduct(p); }}
                    style={{
                      display: 'flex', gap: 12, padding: '10px 12px', borderRadius: 10,
                      border: '1px solid var(--border)', cursor: pickingProduct ? 'default' : 'pointer',
                      opacity: pickingProduct ? 0.5 : 1,
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => { if (!pickingProduct) { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'; (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-input)'; } }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.background = ''; }}
                  >
                    <div style={{
                      width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
                      background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4">
                          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.productName}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {[p.brandName, p.category].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0, alignSelf: 'center' }}>
                      {p.price != null ? `$${p.price.toLocaleString()}` : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── OR divider ───────────────────────────────────── */}
      <div className="divider" style={{ margin: '24px 0' }}>or add manually</div>

      {/* ── Manual form ──────────────────────────────────── */}
      <div className="card" style={{ padding: 32 }}>
        <form onSubmit={handleSubmit} noValidate>

          <SectionHeading>Product information</SectionHeading>

          <Field label="Product Name *">
            <input
              className="input-field"
              type="text"
              placeholder="e.g. Eames Lounge Chair"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </Field>

          <Field label="Source URL *">
            <input
              className="input-field"
              type="url"
              placeholder="https://vendor.com/product-page"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Brand" optional>
              <input className="input-field" type="text" placeholder="Herman Miller" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
            </Field>
            <Field label="Price" optional>
              <input className="input-field" type="number" placeholder="0.00" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Category" optional>
              <input className="input-field" type="text" placeholder="Seating, Lighting, Tables…" value={category} onChange={(e) => setCategory(e.target.value)} />
            </Field>
            <Field label="Material" optional>
              <input className="input-field" type="text" placeholder="Leather, Wood, Metal…" value={material} onChange={(e) => setMaterial(e.target.value)} />
            </Field>
          </div>

          {/* ── Media ────────────────────────────────────── */}
          <SectionHeading>
            Media & links{' '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10.5, opacity: 0.7 }}>(optional)</span>
          </SectionHeading>

          {/* Image URL warning */}
          {imageUrlWarning && (
            <div style={{
              marginBottom: 14, padding: '10px 14px', borderRadius: 8,
              background: 'rgba(168,113,10,0.06)', border: '1px solid rgba(168,113,10,0.2)',
              fontSize: 12.5, color: 'var(--gold)',
            }}>
              The image URL could not be verified and was removed. You can add one manually below.
            </div>
          )}

          {/* Image preview */}
          {imageUrl && (
            <div style={{
              marginBottom: 14, borderRadius: 10, overflow: 'hidden',
              border: '1px solid var(--border)', height: 160,
              background: 'var(--bg-input)', position: 'relative',
            }}>
              <img
                src={imageUrl}
                alt="Product preview"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}

          <Field label="Image URL" optional>
            <input className="input-field" type="url" placeholder="https://images.vendor.com/product.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          </Field>

          <Field label="Product Page URL" optional>
            <input className="input-field" type="url" placeholder="https://vendor.com/product" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} />
          </Field>

          {/* ── Dimensions ──────────────────────────────── */}
          <SectionHeading>
            Dimensions{' '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10.5, opacity: 0.7 }}>(optional)</span>
          </SectionHeading>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 90px', gap: 12 }}>
            <Field label="Length">
              <input className="input-field" type="number" placeholder="0" min="0" step="0.1" value={dimLength} onChange={(e) => setDimLength(e.target.value)} />
            </Field>
            <Field label="Width">
              <input className="input-field" type="number" placeholder="0" min="0" step="0.1" value={dimWidth} onChange={(e) => setDimWidth(e.target.value)} />
            </Field>
            <Field label="Height">
              <input className="input-field" type="number" placeholder="0" min="0" step="0.1" value={dimHeight} onChange={(e) => setDimHeight(e.target.value)} />
            </Field>
            <Field label="Unit">
              <select className="select-field" value={dimUnit} onChange={(e) => setDimUnit(e.target.value as 'in' | 'cm' | 'ft')}>
                <option value="in">in</option>
                <option value="cm">cm</option>
                <option value="ft">ft</option>
              </select>
            </Field>
          </div>

          {/* ── Finishes ────────────────────────────────── */}
          <SectionHeading>
            Finishes{' '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10.5, opacity: 0.7 }}>(optional)</span>
          </SectionHeading>

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
            <button type="button" className="btn-ghost" onClick={addFinish} style={{ flexShrink: 0, fontSize: 12 }}>
              Add
            </button>
          </div>

          {finishes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {finishes.map((f) => (
                <span
                  key={f}
                  className="tag-chip"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                  onClick={() => removeFinish(f)}
                >
                  {f}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </span>
              ))}
            </div>
          )}

          {/* ── Lead time ───────────────────────────────── */}
          <Field label="Lead Time" optional>
            <input className="input-field" type="text" placeholder="e.g. 4-6 weeks" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} />
          </Field>

          {error && <div className="error-box" style={{ marginBottom: 20 }}>{error}</div>}

          {/* ── Actions ─────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 10, marginTop: 28, paddingTop: 22, borderTop: '1px solid var(--border)' }}>
            <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? (
                <>
                  <svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  Save product
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
            <Link href="/catalog" className="btn-ghost" style={{ textDecoration: 'none' }}>
              Cancel
            </Link>
          </div>

        </form>
      </div>
    </div>
  );
}
