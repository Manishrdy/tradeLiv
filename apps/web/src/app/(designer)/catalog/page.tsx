'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ProductListItem } from '@/lib/api';

function formatPrice(price: number | null) {
  if (price == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CatalogPage() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.getProductCategories().then((r) => {
      if (r.data) setCategories(r.data);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    api.getProducts({
      search: search.trim() || undefined,
      category: category || undefined,
      page,
      limit: 20,
      includeInactive: showInactive || undefined,
    }).then((r) => {
      if (r.data) {
        setProducts(r.data.products);
        setTotalPages(r.data.pagination.totalPages);
        setTotal(r.data.pagination.total);
      }
      setLoading(false);
    });
  }, [search, category, page, showInactive]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, category, showInactive]);

  return (
    <div style={{ padding: '40px 44px', maxWidth: 1100 }}>

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.035em', marginBottom: 4 }}>
            Product Catalog
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {total > 0 ? `${total} product${total !== 1 ? 's' : ''}` : 'No products yet'}
          </p>
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

      {/* ── Filters ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
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

        {categories.length > 0 && (
          <select
            className="select-field"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 500 }}>
          <div
            onClick={() => setShowInactive((v) => !v)}
            style={{
              width: 32, height: 17, borderRadius: 999,
              background: showInactive ? '#111111' : 'var(--border-strong)',
              position: 'relative', transition: 'background 0.18s', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: 2.5, left: showInactive ? 16 : 2.5,
              width: 12, height: 12, borderRadius: '50%', background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.18s',
            }} />
          </div>
          Show inactive
        </label>
      </div>

      {/* ── Loading ─────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13.5, padding: '48px 0' }}>
          <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading products…
        </div>
      ) : products.length === 0 ? (
        /* ── Empty state ─────────────────────────────────── */
        <div style={{ textAlign: 'center', padding: '72px 0' }}>
          <div style={{
            width: 50, height: 50, borderRadius: 13, margin: '0 auto 16px',
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.6" strokeLinecap="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            {search || category ? 'No products match your filters' : 'No products yet'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 22 }}>
            {search || category ? 'Try a different search term or category.' : 'Add your first product to build your catalog.'}
          </div>
          {!search && !category && (
            <Link href="/catalog/new" style={{ textDecoration: 'none' }}>
              <button className="btn-primary">Add first product</button>
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* ── Product grid ────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {products.map((p) => (
              <Link key={p.id} href={`/catalog/${p.id}`} style={{ textDecoration: 'none' }}>
                <div
                  className="card"
                  style={{
                    overflow: 'hidden', cursor: 'pointer',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    opacity: p.isActive ? 1 : 0.6,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = '';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                  }}
                >
                  {/* Image */}
                  <div style={{
                    width: '100%', height: 160,
                    background: 'var(--bg-input)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', position: 'relative',
                  }}>
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.productName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.4" strokeLinecap="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    )}
                    {!p.isActive && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        background: 'rgba(0,0,0,0.7)', color: '#fff',
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                      }}>
                        Inactive
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: '14px 18px 18px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.productName}
                    </div>

                    {p.brandName && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.brandName}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                        {formatPrice(p.price)}
                      </div>
                      {p.category && (
                        <span className="tag-chip">{p.category}</span>
                      )}
                    </div>

                    {/* Meta row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {p._count.shortlistItems > 0
                          ? `In ${p._count.shortlistItems} shortlist${p._count.shortlistItems !== 1 ? 's' : ''}`
                          : 'Not shortlisted'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {formatDate(p.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* ── Pagination ──────────────────────────────────── */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 32 }}>
              <button
                className="btn-ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ fontSize: 12, padding: '6px 12px' }}
              >
                Previous
              </button>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 500 }}>
                Page {page} of {totalPages}
              </span>
              <button
                className="btn-ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{ fontSize: 12, padding: '6px 12px' }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
