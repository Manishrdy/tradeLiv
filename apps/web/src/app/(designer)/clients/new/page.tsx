'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ClientPayload } from '@/lib/api';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';

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

/* ── Phone formatting helper ──────────────────────── */

function formatPhoneDisplay(value: string): string {
  // Strip non-digits except leading +
  const hasPlus = value.startsWith('+');
  const digits = value.replace(/[^\d]/g, '');

  if (hasPlus) {
    // International format: +1 (555) 867-5309
    if (digits.length <= 1) return `+${digits}`;
    const cc = digits.slice(0, 1);
    const rest = digits.slice(1);
    if (rest.length <= 3) return `+${cc} (${rest}`;
    if (rest.length <= 6) return `+${cc} (${rest.slice(0, 3)}) ${rest.slice(3)}`;
    return `+${cc} (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6, 10)}`;
  }

  // US format: (555) 867-5309
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function PhoneInput({ value, onChange, ...props }: { value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Allow typing + at start
    if (raw === '+' || raw === '') { onChange(raw); return; }
    onChange(formatPhoneDisplay(raw));
  }

  return (
    <div style={{ position: 'relative' }}>
      <span style={{
        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
        fontSize: 13, color: 'var(--text-muted)', pointerEvents: 'none',
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12 19.79 19.79 0 0 1 1.97 3.32 2 2 0 0 1 3.94 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.99 5.99l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      </span>
      <input
        className="input-field"
        type="tel"
        value={value}
        onChange={handleChange}
        style={{ paddingLeft: 34 }}
        {...props}
      />
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
              <PhoneInput
                value={phone}
                onChange={setPhone}
                placeholder="+1 (555) 867-5309"
              />
            </Field>
          </div>

          {/* ── Billing address ──────────────────────────── */}
          <SectionHeading>
            Billing address{' '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10.5, opacity: 0.7 }}>(optional)</span>
          </SectionHeading>

          <Field label="Address Line 1">
            <AddressAutocomplete
              value={billLine1}
              onChange={setBillLine1}
              placeholder="42 Maple Street"
              onAddressSelect={(parts) => {
                setBillLine1(parts.line1);
                setBillCity(parts.city);
                setBillState(parts.state);
                setBillZip(parts.zip);
              }}
            />
          </Field>
          <Field label="Address Line 2">
            <input className="input-field" type="text" placeholder="Apt 3B, Suite 100" value={billLine2} onChange={(e) => setBillLine2(e.target.value)} />
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

          {/* Same as billing toggle with auto-fill */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 18 }}>
            <div
              onClick={() => {
                const next = !sameAddress;
                setSameAddress(next);
                if (next) {
                  // Auto-fill shipping from billing with a brief delay for visual feedback
                  setTimeout(() => {
                    setShipLine1(billLine1);
                    setShipLine2(billLine2);
                    setShipCity(billCity);
                    setShipState(billState);
                    setShipZip(billZip);
                  }, 100);
                } else {
                  // Clear shipping when unchecking
                  setShipLine1('');
                  setShipLine2('');
                  setShipCity('');
                  setShipState('');
                  setShipZip('');
                }
              }}
              style={{
                width: 38, height: 20, borderRadius: 999,
                background: sameAddress ? '#111111' : 'var(--border-strong)',
                position: 'relative', transition: 'background 0.2s ease', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: sameAddress ? 19 : 3,
                width: 14, height: 14, borderRadius: '50%', background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transition: 'left 0.2s cubic-bezier(0.22,1,0.36,1)',
              }} />
            </div>
            <div>
              <span style={{ fontSize: 13.5, color: 'var(--text-secondary)', fontWeight: 500 }}>Same as billing address</span>
              {sameAddress && billLine1 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, transition: 'opacity 0.2s', opacity: 1 }}>
                  {[billLine1, billCity, billState].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </label>

          {!sameAddress && (
            <div style={{ animation: 'fadeSlideUp 0.25s ease both' }}>
              <Field label="Address Line 1">
                <AddressAutocomplete
                  value={shipLine1}
                  onChange={setShipLine1}
                  placeholder="42 Maple Street"
                  onAddressSelect={(parts) => {
                    setShipLine1(parts.line1);
                    setShipCity(parts.city);
                    setShipState(parts.state);
                    setShipZip(parts.zip);
                  }}
                />
              </Field>
              <Field label="Address Line 2">
                <input className="input-field" type="text" placeholder="Apt 3B, Suite 100" value={shipLine2} onChange={(e) => setShipLine2(e.target.value)} />
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
