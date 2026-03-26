'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, SearchResultItem, ProductPayload } from '@/lib/api';

/* ─── Extraction steps for animation ──────────────── */

const SEARCH_STEPS = [
  'Searching across US furniture retailers…',
  'Browsing West Elm, CB2, Wayfair, RH…',
  'Comparing products to your specs…',
  'Ranking best matches…',
];

const EXTRACT_STEPS = [
  'Visiting product page…',
  'Reading product details…',
  'Extracting structured data…',
  'Almost done…',
];

/* ─── Main Page ────────────────────────────────────── */

export default function ProductSearchPage() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Search state
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchStep, setSearchStep] = useState(0);
  const [searchError, setSearchError] = useState('');

  // Results state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  // Selection & extraction state — single selection
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractStep, setExtractStep] = useState(0);
  const [extractResult, setExtractResult] = useState<{ url: string; success: boolean; productId?: string; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Rate limit cooldown
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  function startCooldown(seconds: number) {
    setCooldownSeconds(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // Check rate limit status after search/extract completes
  const checkRateLimit = useCallback(async () => {
    const r = await api.getSearchRateLimit();
    if (r.data && !r.data.available && r.data.retryAfter > 0) {
      startCooldown(r.data.retryAfter);
    }
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const isLocked = cooldownSeconds > 0;

  /* ── Step animation ─────────────────────────────── */
  function animateSteps(steps: string[], setter: (n: number) => void, interval = 2500): () => void {
    let i = 0;
    setter(0);
    const timer = setInterval(() => {
      i = Math.min(i + 1, steps.length - 1);
      setter(i);
    }, interval);
    return () => clearInterval(timer);
  }

  /* ── Search ─────────────────────────────────────── */
  async function handleSearch() {
    if (query.trim().length < 10) {
      setSearchError('Please describe the product in more detail (at least 10 characters).');
      return;
    }

    setSearching(true);
    setSearchError('');
    setResults([]);
    setSelectedUrl(null);
    setExtractResult(null);
    setSessionId(null);
    setFromCache(false);

    const stopAnim = animateSteps(SEARCH_STEPS, setSearchStep);

    const r = await api.searchProducts(query.trim());

    stopAnim();
    setSearching(false);

    if (r.error) {
      setSearchError(r.error);
      checkRateLimit();
      return;
    }

    setSessionId(r.data!.sessionId);
    setResults(r.data!.results);
    setHasMore(r.data!.hasMore);
    setTotal(r.data!.total);
    setFromCache(!!(r.data as any)?.cached);

    // Check rate limit after a successful search (Claude was called)
    if (!(r.data as any)?.cached) {
      checkRateLimit();
    }
  }

  /* ── Load more (show remaining from cache) ──────── */
  async function handleLoadMore() {
    if (!sessionId || loadingMore) return;
    setLoadingMore(true);

    const r = await api.searchMore(sessionId);
    setLoadingMore(false);

    if (r.error) {
      setSearchError(r.error);
      return;
    }

    setResults((prev) => [...prev, ...r.data!.results]);
    setHasMore(r.data!.hasMore);
  }

  /* ── Select single product ──────────────────────── */
  function handleSelect(url: string) {
    setSelectedUrl((prev) => (prev === url ? null : url));
  }

  /* ── Extract & Save single product ──────────────── */
  async function handleExtractSelected() {
    if (!selectedUrl) return;

    setExtracting(true);
    setExtractResult(null);
    const stopAnim = animateSteps(EXTRACT_STEPS, setExtractStep);

    const r = await api.extractSearchResults([selectedUrl]);

    stopAnim();

    if (r.error) {
      setExtracting(false);
      setSearchError(r.error);
      checkRateLimit();
      return;
    }

    // Save the extracted product
    setSaving(true);
    const item = r.data!.results[0];

    if (item.type === 'error') {
      setExtractResult({ url: item.url, success: false, error: item.error || 'Extraction failed' });
      setSaving(false);
      setExtracting(false);
      checkRateLimit();
      return;
    }

    const product = item.type === 'single' ? item.product : item.products?.[0];
    if (!product) {
      setExtractResult({ url: item.url, success: false, error: 'No product data extracted' });
      setSaving(false);
      setExtracting(false);
      checkRateLimit();
      return;
    }

    const payload: ProductPayload = {
      productName: product.productName || 'Unknown Product',
      sourceUrl: item.url,
      brandName: product.brandName || undefined,
      category: product.category || undefined,
      currency: product.currency || 'USD',
      variantId: product.variantId || undefined,
      sku: product.sku || undefined,
      activeVariant: product.activeVariant || undefined,
      images: product.images || undefined,
      pricing: product.pricing || undefined,
      availableOptions: product.availableOptions || undefined,
      features: product.features || [],
      materials: product.materials || undefined,
      promotions: product.promotions || [],
      shipping: product.shipping || undefined,
      availability: product.availability || undefined,
      price: product.activeVariant?.price != null ? Number(product.activeVariant.price) : (product.price ?? undefined),
      imageUrl: product.images?.primary || product.imageUrl || undefined,
      productUrl: product.productUrl || item.url,
      dimensions: product.dimensions || undefined,
      material: typeof product.materials?.primary === 'string' ? product.materials.primary : (product.material || undefined),
      finishes: product.finishes || [],
      leadTime: product.leadTime || undefined,
      metadata: product.metadata || undefined,
    };

    const saveR = await api.createProduct(payload);
    if (saveR.error) {
      setExtractResult({ url: item.url, success: false, error: saveR.error });
    } else {
      setExtractResult({ url: item.url, success: true, productId: (saveR.data as any)?.id });
    }

    setSaving(false);
    setExtracting(false);
    checkRateLimit();
  }

  return (
    <div style={{ padding: '28px 40px 80px', maxWidth: 820 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Link href="/catalog" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textDecoration: 'none', marginBottom: 8 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Catalog
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            Search Products
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
            Describe what you need and we&apos;ll find the top 3 matching products from US furniture retailers.
          </p>
        </div>
        <Link href="/catalog/new" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '8px 16px', fontSize: 12.5, fontWeight: 700,
          textDecoration: 'none', transition: 'all 0.15s',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 10-5.656-5.656l-1.102 1.101" /></svg>
          Add from URL instead
        </Link>
      </div>

      {/* Rate limit cooldown banner */}
      {isLocked && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 18px', marginBottom: 20, borderRadius: 10,
          background: 'rgba(200,164,90,0.08)', border: '1px solid rgba(200,164,90,0.25)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Rate limit active
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Search and product extraction are paused to stay within API limits. Resuming in {cooldownSeconds}s.
            </div>
          </div>
          <div style={{
            fontSize: 20, fontWeight: 900, color: 'var(--gold)',
            fontVariantNumeric: 'tabular-nums', minWidth: 40, textAlign: 'center',
          }}>
            {cooldownSeconds}s
          </div>
        </div>
      )}

      {/* Search input */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
          What are you looking for?
        </label>
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !searching && !isLocked) { e.preventDefault(); handleSearch(); } }}
          placeholder={"e.g. Mid-century modern walnut dining table, seats 6-8, 72\" long, under $2,500. Looking for solid wood with tapered legs, preferably from a US brand with trade pricing..."}
          rows={4}
          className="input-field"
          style={{
            width: '100%', resize: 'vertical', minHeight: 100,
            fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6,
            padding: '14px 16px', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Be specific: include dimensions, material, style, price range, color, and any must-have features.
          </span>
          <button
            onClick={handleSearch}
            disabled={searching || query.trim().length < 10 || isLocked}
            className="btn-primary"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 24px', fontSize: 13, fontWeight: 700,
              borderRadius: 8, fontFamily: 'inherit',
              opacity: (searching || query.trim().length < 10 || isLocked) ? 0.5 : 1,
              cursor: (searching || query.trim().length < 10 || isLocked) ? 'not-allowed' : 'pointer',
            }}
          >
            {searching ? (
              <>
                <svg className="anim-rotate" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
                {SEARCH_STEPS[searchStep]}
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                Search Products
              </>
            )}
          </button>
        </div>
      </div>

      {searchError && (
        <div className="error-box" style={{ marginBottom: 16 }}>{searchError}</div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div>
          {/* Results header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              <span>
                {results.length} of {total} results
              </span>
              {fromCache && (
                <span style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                  background: 'var(--bg-input)', padding: '3px 8px', borderRadius: 4,
                  border: '1px solid var(--border)',
                }}>
                  Cached
                </span>
              )}
              {selectedUrl && (
                <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>
                  · 1 selected
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', fontSize: 12, fontWeight: 700,
                    border: '1px solid var(--border)', background: 'var(--bg-card)',
                    color: 'var(--text-secondary)', borderRadius: 8, fontFamily: 'inherit',
                    cursor: loadingMore ? 'wait' : 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {loadingMore ? (
                    <>
                      <svg className="anim-rotate" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
                      Loading…
                    </>
                  ) : (
                    'Show Other Options'
                  )}
                </button>
              )}
              {selectedUrl && !extracting && !extractResult && (
                <button
                  onClick={handleExtractSelected}
                  disabled={isLocked}
                  className="btn-primary"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 20px', fontSize: 12.5, fontWeight: 700,
                    borderRadius: 8, fontFamily: 'inherit',
                    opacity: isLocked ? 0.5 : 1,
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                  Add to Catalog
                </button>
              )}
            </div>
          </div>

          {/* Extracting indicator */}
          {(extracting || saving) && (
            <div className="card" style={{ padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-input)' }}>
              <svg className="anim-rotate" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                {saving ? 'Saving product to your catalog…' : EXTRACT_STEPS[extractStep]}
              </span>
            </div>
          )}

          {/* Extract result summary */}
          {extractResult && (
            <div className="card" style={{ padding: '16px 20px', marginBottom: 16, border: `1px solid ${extractResult.success ? 'var(--green-border)' : 'rgba(180,30,30,0.18)'}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: extractResult.success ? 'var(--green)' : '#b91c1c', marginBottom: 8 }}>
                {extractResult.success ? 'Product added to your catalog' : 'Could not add product'}
              </div>
              {!extractResult.success && (
                <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>
                  {extractResult.error}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                {extractResult.success && (
                  <button
                    onClick={() => router.push('/catalog')}
                    className="btn-primary"
                    style={{ padding: '7px 16px', fontSize: 12, fontWeight: 700, borderRadius: 8, fontFamily: 'inherit' }}
                  >
                    View Catalog
                  </button>
                )}
                <button
                  onClick={() => { setExtractResult(null); setSelectedUrl(null); }}
                  style={{
                    padding: '7px 16px', fontSize: 12, fontWeight: 700, borderRadius: 8,
                    fontFamily: 'inherit', border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                  }}
                >
                  {extractResult.success ? 'Add Another' : 'Try Different Product'}
                </button>
              </div>
            </div>
          )}

          {/* Result cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {results.map((item, idx) => {
              const isSelected = selectedUrl === item.url;
              const wasExtracted = extractResult?.url === item.url;
              return (
                <div
                  key={item.url + idx}
                  onClick={() => { if (!extracting && !saving && !(wasExtracted && extractResult?.success)) handleSelect(item.url); }}
                  className="card"
                  style={{
                    padding: '16px 20px',
                    display: 'flex', gap: 16, alignItems: 'flex-start',
                    cursor: (extracting || saving || (wasExtracted && extractResult?.success)) ? 'default' : 'pointer',
                    border: isSelected ? '1.5px solid var(--gold)' : (wasExtracted && extractResult?.success) ? '1.5px solid var(--green-border)' : '1px solid var(--border)',
                    background: isSelected ? 'rgba(200,164,90,0.04)' : (wasExtracted && extractResult?.success) ? 'var(--green-dim)' : 'var(--bg-card)',
                    opacity: wasExtracted && !extractResult?.success ? 0.5 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  {/* Radio indicator */}
                  <div style={{ flexShrink: 0, marginTop: 2 }}>
                    {wasExtracted && extractResult?.success ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    ) : (
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        border: isSelected ? '2px solid var(--gold)' : '2px solid var(--border)',
                        background: 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}>
                        {isSelected && (
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: 'var(--gold)',
                          }} />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Product image */}
                  {item.imageUrl && (
                    <div style={{
                      width: 80, height: 80, borderRadius: 8, overflow: 'hidden',
                      flexShrink: 0, background: 'var(--bg-input)', border: '1px solid var(--border)',
                    }}>
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}

                  {/* Product info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>
                          {item.brand}
                          {item.category && <span style={{ fontWeight: 400 }}> · {item.category}</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {item.price || '—'}
                      </div>
                    </div>

                    {/* Details row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      {item.dimensions && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
                          {item.dimensions}
                        </span>
                      )}
                      {item.material && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                          {item.material}
                        </span>
                      )}
                    </div>

                    {item.description && (
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
                        {item.description}
                      </div>
                    )}

                    {/* Source link */}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, textDecoration: 'none', fontWeight: 500 }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></svg>
                      View on {new URL(item.url).hostname.replace('www.', '')}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state after search */}
      {!searching && results.length === 0 && sessionId && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>&#128270;</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            No products found
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto', lineHeight: 1.5 }}>
            Try being more specific about the style, dimensions, or material. You can also try different keywords or a broader description.
          </div>
        </div>
      )}

      {/* Initial state — before any search */}
      {!searching && results.length === 0 && !sessionId && !searchError && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
          {[
            { title: 'Dining Table', desc: 'Solid walnut, mid-century modern, seats 6, 72" long, under $2,500' },
            { title: 'Accent Chair', desc: 'Velvet upholstered, brass legs, emerald green, swivel base, compact' },
            { title: 'Console Table', desc: 'Marble top with black metal base, 48" wide, modern minimalist' },
            { title: 'Sectional Sofa', desc: 'Performance fabric, L-shaped, 110" wide, cloud-style, white/cream' },
          ].map((ex) => (
            <button
              key={ex.title}
              onClick={() => { setQuery(ex.desc); textareaRef.current?.focus(); }}
              className="card"
              style={{
                padding: '16px 18px', textAlign: 'left', cursor: 'pointer',
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                {ex.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {ex.desc}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
