'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { api, ProductListItem } from '@/lib/api';

/* ── Helpers ───────────────────────────────────────── */

const currFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

function formatPrice(price: number | null) {
  if (price == null) return '—';
  return currFmt.format(price);
}

/** Derive display price from new pricing fields, falling back to legacy price */
function getDisplayPrice(p: ProductListItem): number | null {
  if (p.activeVariant?.price != null) return Number(p.activeVariant.price);
  if (p.pricing && p.pricing.length > 0 && p.pricing[0].price != null) return Number(p.pricing[0].price);
  return p.price;
}

/** Format price range from pricing matrix */
function formatPriceRange(p: ProductListItem): string {
  if (p.pricing && p.pricing.length > 1) {
    const prices = p.pricing.map(e => Number(e.price)).filter(n => !isNaN(n) && n > 0);
    if (prices.length > 1) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (min !== max) return `${currFmt.format(min)} – ${currFmt.format(max)}`;
    }
  }
  return formatPrice(getDisplayPrice(p));
}

/** Resolve primary image URL from new images field, falling back to legacy */
function getImageUrl(p: ProductListItem): string | undefined {
  const imgs = p.images as { primary?: string } | null;
  return imgs?.primary || p.imageUrl || undefined;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

const FAV_KEY = 'tradeliv-catalog-favorites';
function loadFavorites(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveFavorites(fav: Set<string>) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...fav]));
}

/* ── Image zoom overlay ────────────────────────────── */

function ZoomOverlay({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'zoom-out',
      }}
    >
      <img
        src={src}
        alt={alt}
        className="anim-scale-in"
        style={{ maxWidth: '85vw', maxHeight: '85vh', borderRadius: 12, objectFit: 'contain', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
      />
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 20, right: 20,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)', border: 'none',
          color: '#fff', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

/* ── Compare modal ─────────────────────────────────── */

function CompareModal({ items, onClose, onRemove }: { items: ProductListItem[]; onClose: () => void; onRemove: (id: string) => void }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        className="anim-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 900,
          maxHeight: '80vh', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: '28px 32px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
            Compare Products ({items.length})
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`, gap: 16 }}>
          {items.map((p) => (
            <div key={p.id} style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
              {/* Image */}
              <div style={{ height: 140, background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {getImageUrl(p) ? (
                  <img src={getImageUrl(p)} alt={p.productName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4">
                    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                  </svg>
                )}
              </div>
              {/* Details */}
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.productName}
                </div>
                {[
                  { label: 'Brand', value: p.brandName },
                  { label: 'Price', value: formatPriceRange(p) },
                  { label: 'Category', value: p.category },
                  { label: 'Material', value: p.material },
                  { label: 'Lead Time', value: p.leadTime },
                  { label: 'Finishes', value: p.finishes?.length ? p.finishes.join(', ') : null },
                ].map((row) => row.value && (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{row.label}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
                  </div>
                ))}
                <button
                  onClick={() => onRemove(p.id)}
                  style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#b91c1c')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Catalog Page
   ══════════════════════════════════════════════════════ */

export default function CatalogPage() {
  const [products, setProducts]     = useState<ProductListItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch]         = useState('');
  const [category, setCategory]     = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [viewMode, setViewMode]     = useState<'grid' | 'list'>('grid');
  const [favorites, setFavorites]   = useState<Set<string>>(new Set());
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const [zoomImg, setZoomImg]       = useState<{ src: string; alt: string } | null>(null);
  const [priceMin, setPriceMin]     = useState('');
  const [priceMax, setPriceMax]     = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getProductCategories().then((r) => { if (r.data) setCategories(r.data); });
    setFavorites(loadFavorites());
  }, []);

  // Fetch products
  const fetchProducts = useCallback((pageNum: number, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);
    api.getProducts({
      search: search.trim() || undefined,
      category: category || undefined,
      page: pageNum,
      limit: 20,
      includeInactive: showInactive || undefined,
    }).then((r) => {
      if (r.data) {
        if (append) {
          setProducts((prev) => [...prev, ...r.data!.products]);
        } else {
          setProducts(r.data.products);
        }
        setTotalPages(r.data.pagination.totalPages);
        setTotal(r.data.pagination.total);
      }
      setLoading(false);
      setLoadingMore(false);
    });
  }, [search, category, showInactive]);

  // Reset + fetch when filters change
  useEffect(() => {
    setPage(1);
    fetchProducts(1, false);
  }, [fetchProducts]);

  // Load more
  function loadMore() {
    if (page >= totalPages || loadingMore) return;
    const next = page + 1;
    setPage(next);
    fetchProducts(next, true);
  }

  // Favorites
  function toggleFav(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveFavorites(next);
      return next;
    });
  }

  // Compare
  function toggleCompare(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  }

  // Filter by price range + favorites
  let displayed = products;
  if (priceMin) displayed = displayed.filter((p) => (getDisplayPrice(p) ?? 0) >= Number(priceMin));
  if (priceMax) displayed = displayed.filter((p) => (getDisplayPrice(p) ?? Infinity) <= Number(priceMax));
  if (showFavOnly) displayed = displayed.filter((p) => favorites.has(p.id));

  const compareItems = products.filter((p) => compareIds.has(p.id));

  return (
    <div style={{ padding: '40px 44px', maxWidth: 1100 }}>

      {/* ── Header ──────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.035em', marginBottom: 4 }}>
            Product Catalog
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {total > 0 ? `${total} product${total !== 1 ? 's' : ''}` : 'No products yet'}
            {favorites.size > 0 && <span style={{ color: 'var(--text-muted)' }}> · {favorites.size} favorited</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {(['grid', 'list'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '7px 10px', border: 'none', cursor: 'pointer',
                  background: viewMode === mode ? 'var(--bg-input)' : 'transparent',
                  color: viewMode === mode ? 'var(--text-primary)' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center',
                  transition: 'all 0.12s',
                }}
              >
                {mode === 'grid' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                )}
              </button>
            ))}
          </div>
          <Link href="/catalog/new" style={{ textDecoration: 'none' }}>
            <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Product
            </button>
          </Link>
        </div>
      </div>

      {/* ── Category pills ─────────────────────────── */}
      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            onClick={() => setCategory('')}
            style={{
              border: `1px solid ${!category ? '#111' : 'var(--border)'}`,
              background: !category ? '#111' : 'transparent',
              color: !category ? '#fff' : 'var(--text-muted)',
              borderRadius: 999, padding: '5px 14px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit',
            }}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(category === c ? '' : c)}
              style={{
                border: `1px solid ${category === c ? '#111' : 'var(--border)'}`,
                background: category === c ? '#111' : 'transparent',
                color: category === c ? '#fff' : 'var(--text-muted)',
                borderRadius: 999, padding: '5px 14px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* ── Search + Filters row ────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="input-field"
            type="text"
            placeholder="Search by name or brand…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34, width: '100%' }}
          />
        </div>

        {/* Price range filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Price</span>
          <input
            className="input-field"
            type="number"
            placeholder="Min"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            style={{ width: 80, padding: '7px 10px', fontSize: 12 }}
            min="0"
          />
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>–</span>
          <input
            className="input-field"
            type="number"
            placeholder="Max"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            style={{ width: 80, padding: '7px 10px', fontSize: 12 }}
            min="0"
          />
        </div>

        {/* Favorites toggle */}
        <button
          onClick={() => setShowFavOnly((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 12px', borderRadius: 8,
            border: `1px solid ${showFavOnly ? '#b91c1c20' : 'var(--border)'}`,
            background: showFavOnly ? 'rgba(185,28,28,0.04)' : 'transparent',
            color: showFavOnly ? '#b91c1c' : 'var(--text-muted)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.12s',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill={showFavOnly ? '#b91c1c' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {showFavOnly ? `Favorites (${favorites.size})` : 'Favorites'}
        </button>

        {/* Inactive toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
          <div
            onClick={() => setShowInactive((v) => !v)}
            title="Inactive products are hidden from client portals"
            style={{
              width: 32, height: 17, borderRadius: 999,
              background: showInactive ? '#111' : 'var(--border-strong)',
              position: 'relative', transition: 'background 0.18s', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: 2.5, left: showInactive ? 16 : 2.5,
              width: 12, height: 12, borderRadius: '50%', background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.18s',
            }} />
          </div>
          <span>
            Inactive
            <span style={{ fontSize: 10, color: 'var(--text-placeholder)', marginLeft: 3 }}>(hidden from clients)</span>
          </span>
        </label>
      </div>

      {/* ── Compare bar ────────────────────────────── */}
      {compareIds.size > 0 && (
        <div className="anim-fade-up" style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px', marginBottom: 16,
          background: '#111', borderRadius: 10, color: '#fff',
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{compareIds.size} selected</span>
          <button
            onClick={() => setShowCompare(true)}
            disabled={compareIds.size < 2}
            style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6,
              padding: '5px 14px', fontSize: 12, fontWeight: 600, color: '#fff',
              cursor: compareIds.size < 2 ? 'not-allowed' : 'pointer',
              opacity: compareIds.size < 2 ? 0.5 : 1,
              fontFamily: 'inherit', transition: 'background 0.12s',
            }}
          >
            Compare
          </button>
          <button
            onClick={() => setCompareIds(new Set())}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Loading ────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13.5, padding: '48px 0' }}>
          <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading products…
        </div>
      ) : displayed.length === 0 ? (
        /* ── Empty state ──────────────────────────── */
        <div style={{ textAlign: 'center', padding: '72px 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: '0 auto 18px',
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.6" strokeLinecap="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            {showFavOnly ? 'No favorites yet' : search || category || priceMin || priceMax ? 'No products match your filters' : 'No products yet'}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 24, maxWidth: 300, margin: '0 auto 24px' }}>
            {showFavOnly ? 'Heart products to add them to your favorites.' : search || category ? 'Try adjusting your search or filters.' : 'Add your first product to build your catalog.'}
          </div>
          {!search && !category && !showFavOnly && (
            <Link href="/catalog/new" style={{ textDecoration: 'none' }}>
              <button className="btn-primary">Add first product</button>
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <>
          {/* ── Grid view ──────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {displayed.map((p) => {
              const isFav = favorites.has(p.id);
              const isCompare = compareIds.has(p.id);
              return (
                <div key={p.id} style={{ position: 'relative' }}>
                  <Link href={`/catalog/${p.id}`} style={{ textDecoration: 'none' }}>
                    <div
                      className="card"
                      style={{
                        overflow: 'hidden', cursor: 'pointer',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                        opacity: p.isActive ? 1 : 0.55,
                        outline: isCompare ? '2px solid #2563eb' : 'none', outlineOffset: -1,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                    >
                      {/* Image with zoom */}
                      <div style={{
                        width: '100%', height: 180,
                        background: 'var(--bg-input)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', position: 'relative',
                      }}>
                        {getImageUrl(p) ? (
                          <img
                            src={getImageUrl(p)}
                            alt={p.productName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                          />
                        ) : (
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4" strokeLinecap="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                          </svg>
                        )}
                        {/* Zoom button */}
                        {getImageUrl(p) && (
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setZoomImg({ src: getImageUrl(p)!, alt: p.productName }); }}
                            style={{
                              position: 'absolute', bottom: 8, right: 8,
                              width: 28, height: 28, borderRadius: 6,
                              background: 'rgba(0,0,0,0.5)', border: 'none',
                              color: '#fff', cursor: 'pointer', display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              opacity: 0, transition: 'opacity 0.15s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
                            </svg>
                          </button>
                        )}
                        {!p.isActive && (
                          <div style={{
                            position: 'absolute', top: 8, left: 8,
                            background: 'rgba(0,0,0,0.75)', color: '#fff',
                            fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                            Hidden from clients
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ padding: '14px 18px 16px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.productName}
                        </div>
                        {p.brandName && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                            {p.brandName}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                            {formatPriceRange(p)}
                          </div>
                          {p.category && (
                            <span style={{
                              fontSize: 10.5, fontWeight: 600, padding: '3px 9px',
                              borderRadius: 999, background: 'var(--bg-input)',
                              border: '1px solid var(--border)', color: 'var(--text-muted)',
                            }}>
                              {p.category}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {p._count.shortlistItems > 0 ? `In ${p._count.shortlistItems} shortlist${p._count.shortlistItems !== 1 ? 's' : ''}` : 'Not shortlisted'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {formatDate(p.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* Floating action buttons */}
                  <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, zIndex: 2 }}>
                    {/* Favorite */}
                    <button
                      onClick={(e) => toggleFav(p.id, e)}
                      title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                      style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: isFav ? 'rgba(185,28,28,0.9)' : 'rgba(0,0,0,0.45)',
                        border: 'none', color: '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill={isFav ? '#fff' : 'none'} stroke="currentColor" strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                    {/* Compare */}
                    <button
                      onClick={(e) => toggleCompare(p.id, e)}
                      title={isCompare ? 'Remove from comparison' : 'Add to comparison'}
                      style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: isCompare ? 'rgba(37,99,235,0.9)' : 'rgba(0,0,0,0.45)',
                        border: 'none', color: '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Load more ──────────────────────────── */}
          {page < totalPages && (
            <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}
              >
                {loadingMore ? (
                  <><svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg> Loading…</>
                ) : (
                  `Load more (${total - products.length} remaining)`
                )}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* ── List view ──────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {displayed.map((p) => {
              const isFav = favorites.has(p.id);
              const isCompare = compareIds.has(p.id);
              return (
                <Link key={p.id} href={`/catalog/${p.id}`} style={{ textDecoration: 'none' }}>
                  <div
                    className="card"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: '12px 18px', cursor: 'pointer',
                      transition: 'transform 0.12s, box-shadow 0.12s',
                      opacity: p.isActive ? 1 : 0.55,
                      outline: isCompare ? '2px solid #2563eb' : 'none', outlineOffset: -1,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                  >
                    {/* Thumbnail */}
                    <div style={{
                      width: 56, height: 56, borderRadius: 8, flexShrink: 0,
                      background: 'var(--bg-input)', overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {getImageUrl(p) ? (
                        <img src={getImageUrl(p)} alt={p.productName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                      )}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.productName}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {p.brandName ?? '—'} {p.category && `· ${p.category}`}
                      </div>
                    </div>
                    {/* Price */}
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', flexShrink: 0 }}>
                      {formatPriceRange(p)}
                    </div>
                    {/* Inactive badge */}
                    {!p.isActive && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#b91c1c', background: 'rgba(185,28,28,0.06)', padding: '2px 8px', borderRadius: 999, flexShrink: 0 }}>
                        Hidden
                      </span>
                    )}
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={(e) => toggleFav(p.id, e)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isFav ? '#b91c1c' : 'var(--text-muted)', padding: 4, display: 'flex' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => toggleCompare(p.id, e)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isCompare ? '#2563eb' : 'var(--text-muted)', padding: 4, display: 'flex' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Load more (list view) */}
          {page < totalPages && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
              <button onClick={loadMore} disabled={loadingMore} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
                {loadingMore ? (
                  <><svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg> Loading…</>
                ) : (
                  `Load more (${total - products.length} remaining)`
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Zoom overlay ───────────────────────────── */}
      {zoomImg && <ZoomOverlay src={zoomImg.src} alt={zoomImg.alt} onClose={() => setZoomImg(null)} />}

      {/* ── Compare modal ──────────────────────────── */}
      {showCompare && compareItems.length >= 2 && (
        <CompareModal
          items={compareItems}
          onClose={() => setShowCompare(false)}
          onRemove={(id) => {
            setCompareIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
            if (compareIds.size <= 2) setShowCompare(false);
          }}
        />
      )}
    </div>
  );
}
