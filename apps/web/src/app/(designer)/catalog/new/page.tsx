'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ProductPayload } from '@/lib/api';

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

  // Dimensions
  const [dimLength, setDimLength] = useState('');
  const [dimWidth, setDimWidth] = useState('');
  const [dimHeight, setDimHeight] = useState('');
  const [dimUnit, setDimUnit] = useState<'in' | 'cm' | 'ft'>('in');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    router.push(`/catalog/${result.data!.id}`);
  }

  return (
    <div style={{ padding: '40px 44px', maxWidth: 680 }}>

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
          Add a product to your catalog so you can shortlist it in projects.
        </p>
      </div>

      <div className="card" style={{ padding: 32 }}>
        <form onSubmit={handleSubmit} noValidate>

          {/* ── Basic info ──────────────────────────────── */}
          <SectionHeading>Product information</SectionHeading>

          <Field label="Product Name *">
            <input
              className="input-field"
              type="text"
              placeholder="e.g. Eames Lounge Chair"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              autoFocus
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
              <input
                className="input-field"
                type="text"
                placeholder="Herman Miller"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
              />
            </Field>
            <Field label="Price" optional>
              <input
                className="input-field"
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Category" optional>
              <input
                className="input-field"
                type="text"
                placeholder="Seating, Lighting, Tables…"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </Field>
            <Field label="Material" optional>
              <input
                className="input-field"
                type="text"
                placeholder="Leather, Wood, Metal…"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              />
            </Field>
          </div>

          {/* ── URLs ────────────────────────────────────── */}
          <SectionHeading>
            Media & links{' '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10.5, opacity: 0.7 }}>(optional)</span>
          </SectionHeading>

          <Field label="Image URL" optional>
            <input
              className="input-field"
              type="url"
              placeholder="https://images.vendor.com/product.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </Field>

          <Field label="Product Page URL" optional>
            <input
              className="input-field"
              type="url"
              placeholder="https://vendor.com/product"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
            />
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
            <input
              className="input-field"
              type="text"
              placeholder="e.g. 4-6 weeks"
              value={leadTime}
              onChange={(e) => setLeadTime(e.target.value)}
            />
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
