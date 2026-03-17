'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ClientPayload } from '@/lib/api';

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14, marginTop: 28 }}>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

export default function NewClientPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [billLine1, setBillLine1] = useState('');
  const [billLine2, setBillLine2] = useState('');
  const [billCity, setBillCity] = useState('');
  const [billState, setBillState] = useState('');
  const [billZip, setBillZip] = useState('');

  const [sameAddress, setSameAddress] = useState(true);
  const [shipLine1, setShipLine1] = useState('');
  const [shipLine2, setShipLine2] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipState, setShipState] = useState('');
  const [shipZip, setShipZip] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Client name is required.'); return; }

    setLoading(true);
    setError('');

    const billing = (billLine1 || billCity || billState || billZip)
      ? { line1: billLine1, line2: billLine2, city: billCity, state: billState, zip: billZip }
      : undefined;

    const shipping = sameAddress
      ? billing
      : (shipLine1 || shipCity || shipState || shipZip)
        ? { line1: shipLine1, line2: shipLine2, city: shipCity, state: shipState, zip: shipZip }
        : undefined;

    const payload: ClientPayload = {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      billingAddress: billing,
      shippingAddress: shipping,
    };

    const result = await api.createClient(payload);
    setLoading(false);

    if (result.error) { setError(result.error); return; }
    router.push(`/clients/${result.data!.id}`);
  }

  return (
    <div style={{ padding: '40px 44px', maxWidth: 680 }}>

      {/* ── Back + header ────────────────────────────────── */}
      <Link
        href="/clients"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, textDecoration: 'none', marginBottom: 28 }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to clients
      </Link>

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.035em', marginBottom: 4 }}>
          Add a client
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Create a client profile to associate projects and orders with.
        </p>
      </div>

      <div className="card" style={{ padding: 32 }}>
        <form onSubmit={handleSubmit} noValidate>

          {/* ── Contact info ─────────────────────────────── */}
          <SectionHeading>Contact information</SectionHeading>

          <Field label="Full Name *">
            <input
              className="input-field"
              type="text"
              placeholder="Sarah Johnson"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Email Address">
              <input
                className="input-field"
                type="email"
                placeholder="sarah@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Phone Number">
              <input
                className="input-field"
                type="tel"
                placeholder="(555) 867-5309"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
          </div>

          {/* ── Billing address ──────────────────────────── */}
          <SectionHeading>
            Billing address{' '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10.5, opacity: 0.7 }}>(optional)</span>
          </SectionHeading>

          <Field label="Address Line 1">
            <input className="input-field" type="text" placeholder="42 Maple Street, Apt 3B" value={billLine1} onChange={(e) => setBillLine1(e.target.value)} />
          </Field>
          <Field label="Address Line 2">
            <input className="input-field" type="text" placeholder="Suite 100" value={billLine2} onChange={(e) => setBillLine2(e.target.value)} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: 12 }}>
            <Field label="City">
              <input className="input-field" type="text" placeholder="New York" value={billCity} onChange={(e) => setBillCity(e.target.value)} />
            </Field>
            <Field label="State">
              <input className="input-field" type="text" placeholder="NY" value={billState} onChange={(e) => setBillState(e.target.value)} />
            </Field>
            <Field label="ZIP Code">
              <input className="input-field" type="text" placeholder="10001" value={billZip} onChange={(e) => setBillZip(e.target.value)} />
            </Field>
          </div>

          {/* ── Shipping address ─────────────────────────── */}
          <SectionHeading>
            Shipping address{' '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10.5, opacity: 0.7 }}>(optional)</span>
          </SectionHeading>

          {/* Same as billing toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 18 }}>
            <div
              onClick={() => setSameAddress((v) => !v)}
              style={{
                width: 38, height: 20, borderRadius: 999,
                background: sameAddress ? '#111111' : 'var(--border-strong)',
                position: 'relative', transition: 'background 0.18s', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: sameAddress ? 19 : 3,
                width: 14, height: 14, borderRadius: '50%', background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.18s',
              }} />
            </div>
            <span style={{ fontSize: 13.5, color: 'var(--text-secondary)', fontWeight: 500 }}>Same as billing address</span>
          </label>

          {!sameAddress && (
            <div>
              <Field label="Address Line 1">
                <input className="input-field" type="text" placeholder="42 Maple Street, Apt 3B" value={shipLine1} onChange={(e) => setShipLine1(e.target.value)} />
              </Field>
              <Field label="Address Line 2">
                <input className="input-field" type="text" placeholder="Suite 100" value={shipLine2} onChange={(e) => setShipLine2(e.target.value)} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: 12 }}>
                <Field label="City">
                  <input className="input-field" type="text" placeholder="New York" value={shipCity} onChange={(e) => setShipCity(e.target.value)} />
                </Field>
                <Field label="State">
                  <input className="input-field" type="text" placeholder="NY" value={shipState} onChange={(e) => setShipState(e.target.value)} />
                </Field>
                <Field label="ZIP Code">
                  <input className="input-field" type="text" placeholder="10001" value={shipZip} onChange={(e) => setShipZip(e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {error && <div className="error-box" style={{ marginBottom: 20 }}>{error}</div>}

          {/* ── Actions ──────────────────────────────────── */}
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
                  Save client
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
            <Link href="/clients" className="btn-ghost" style={{ textDecoration: 'none' }}>
              Cancel
            </Link>
          </div>

        </form>
      </div>
    </div>
  );
}
