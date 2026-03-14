'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ClientDetail, ClientPayload, Address } from '@/lib/api';

function GenerateLinkButton({ projectId, onGenerated }: { projectId: string; onGenerated: (token: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    setLoading(true);
    setError('');
    const result = await api.generatePortalToken(projectId);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    onGenerated(result.data!.portalToken);
  }

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={loading}
        title="Generate client portal link"
        style={{
          background: 'transparent',
          border: '1px dashed var(--border-strong)',
          borderRadius: 7, padding: '3px 9px',
          fontSize: 11, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
          color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: 5,
          transition: 'all 0.15s',
        }}
      >
        {loading ? (
          <>
            <svg className="anim-rotate" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
            Generating…
          </>
        ) : (
          <>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Generate link
          </>
        )}
      </button>
      {error && <div style={{ fontSize: 11, color: '#b41e1e', marginTop: 4 }}>{error}</div>}
    </div>
  );
}

function CopyLinkButton({ portalToken }: { portalToken: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    const url = `${window.location.origin}/client/p/${portalToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy client portal link"
      style={{
        background: copied ? 'rgba(39,103,73,0.12)' : 'transparent',
        border: `1px solid ${copied ? 'rgba(39,103,73,0.3)' : 'var(--border)'}`,
        borderRadius: 7, padding: '3px 9px',
        fontSize: 11, fontWeight: 700, cursor: 'pointer',
        color: copied ? '#276749' : 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: 5,
        transition: 'all 0.15s', flexShrink: 0,
      }}
    >
      {copied ? (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          Copy link
        </>
      )}
    </button>
  );
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatAddress(addr?: Address | null) {
  if (!addr) return null;
  return [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
}

const PROJECT_STATUS_COLORS: Record<string, { bg: string; border: string; color: string; label: string }> = {
  draft:   { bg: 'rgba(0,0,0,0.05)',   border: 'rgba(0,0,0,0.12)',    color: 'var(--text-muted)',   label: 'Draft' },
  active:  { bg: 'rgba(39,103,73,0.1)', border: 'rgba(39,103,73,0.22)', color: '#276749',             label: 'Active' },
  ordered: { bg: 'rgba(44,82,130,0.1)', border: 'rgba(44,82,130,0.22)', color: '#2c5282',             label: 'Ordered' },
  closed:  { bg: 'rgba(0,0,0,0.05)',   border: 'rgba(0,0,0,0.12)',    color: 'var(--text-muted)',   label: 'Closed' },
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14, marginTop: 28 }}>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Edit form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [billLine1, setBillLine1] = useState('');
  const [billLine2, setBillLine2] = useState('');
  const [billCity, setBillCity] = useState('');
  const [billState, setBillState] = useState('');
  const [billPincode, setBillPincode] = useState('');
  const [shipLine1, setShipLine1] = useState('');
  const [shipLine2, setShipLine2] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipState, setShipState] = useState('');
  const [shipPincode, setShipPincode] = useState('');
  const [sameAddress, setSameAddress] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.getClient(id).then((r) => {
      if (r.data) {
        setClient(r.data);
        populateForm(r.data);
      }
      setLoading(false);
    });
  }, [id]);

  function populateForm(c: ClientDetail) {
    setName(c.name);
    setEmail(c.email ?? '');
    setPhone(c.phone ?? '');
    const b = c.billingAddress as Address | null;
    setBillLine1(b?.line1 ?? '');
    setBillLine2(b?.line2 ?? '');
    setBillCity(b?.city ?? '');
    setBillState(b?.state ?? '');
    setBillPincode(b?.pincode ?? '');
    const s = c.shippingAddress as Address | null;
    setShipLine1(s?.line1 ?? '');
    setShipLine2(s?.line2 ?? '');
    setShipCity(s?.city ?? '');
    setShipState(s?.state ?? '');
    setShipPincode(s?.pincode ?? '');
    setSameAddress(JSON.stringify(b) === JSON.stringify(s));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Client name is required.'); return; }
    setSaving(true);
    setError('');

    const billing = (billLine1 || billCity || billState || billPincode)
      ? { line1: billLine1, line2: billLine2, city: billCity, state: billState, pincode: billPincode }
      : undefined;

    const shipping = sameAddress
      ? billing
      : (shipLine1 || shipCity || shipState || shipPincode)
        ? { line1: shipLine1, line2: shipLine2, city: shipCity, state: shipState, pincode: shipPincode }
        : undefined;

    const payload: ClientPayload = {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      billingAddress: billing,
      shippingAddress: shipping,
    };

    const result = await api.updateClient(id, payload);
    setSaving(false);

    if (result.error) { setError(result.error); return; }
    // Refresh from server to get updated projects list
    const fresh = await api.getClient(id);
    if (fresh.data) setClient(fresh.data);
    setEditing(false);
  }

  if (loading) {
    return (
      <div style={{ padding: '36px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 14 }}>
          <svg className="anim-rotate" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading client…
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ padding: '36px 40px' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Client not found.</div>
        <Link href="/clients" style={{ color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>← Back to clients</Link>
      </div>
    );
  }

  const billingStr = formatAddress(client.billingAddress as Address | null);
  const shippingStr = formatAddress(client.shippingAddress as Address | null);

  return (
    <div style={{ padding: '36px 40px', maxWidth: 900 }}>

      {/* ── Back ────────────────────────────────────────── */}
      <Link href="/clients" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textDecoration: 'none', marginBottom: 24 }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--gold)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to clients
      </Link>

      {/* ── Profile header ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(145deg, #e8d5a3, #c9a84c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800, color: '#7a4f0a',
            boxShadow: '0 3px 12px rgba(168,113,10,0.22)',
          }}>
            {initials(client.name)}
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 3 }}>
              {client.name}
            </h1>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Client since {formatDate(client.createdAt)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {!editing && (
            <button className="btn-ghost" onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

        {/* ── Left col ────────────────────────────────────── */}
        <div>

          {/* Edit form */}
          {editing ? (
            <div className="card" style={{ padding: 28 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Edit client details</div>
              <form onSubmit={handleSave} noValidate>
                <SectionHeading>Contact information</SectionHeading>
                <Field label="Full Name *">
                  <input className="input-field" type="text" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Email Address">
                    <input className="input-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </Field>
                  <Field label="Phone Number">
                    <input className="input-field" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </Field>
                </div>

                <SectionHeading>Billing address</SectionHeading>
                <Field label="Address Line 1">
                  <input className="input-field" type="text" value={billLine1} onChange={(e) => setBillLine1(e.target.value)} />
                </Field>
                <Field label="Address Line 2">
                  <input className="input-field" type="text" value={billLine2} onChange={(e) => setBillLine2(e.target.value)} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 14 }}>
                  <Field label="City"><input className="input-field" type="text" value={billCity} onChange={(e) => setBillCity(e.target.value)} /></Field>
                  <Field label="State"><input className="input-field" type="text" value={billState} onChange={(e) => setBillState(e.target.value)} /></Field>
                  <Field label="Pincode"><input className="input-field" type="text" value={billPincode} onChange={(e) => setBillPincode(e.target.value)} /></Field>
                </div>

                <SectionHeading>Shipping address</SectionHeading>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 18 }}>
                  <div onClick={() => setSameAddress((v) => !v)} style={{ width: 40, height: 22, borderRadius: 999, background: sameAddress ? 'var(--gold)' : 'var(--border-strong)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: 3, left: sameAddress ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                  </div>
                  <span style={{ fontSize: 13.5, color: 'var(--text-secondary)', fontWeight: 500 }}>Same as billing address</span>
                </label>
                {!sameAddress && (
                  <div>
                    <Field label="Address Line 1"><input className="input-field" type="text" value={shipLine1} onChange={(e) => setShipLine1(e.target.value)} /></Field>
                    <Field label="Address Line 2"><input className="input-field" type="text" value={shipLine2} onChange={(e) => setShipLine2(e.target.value)} /></Field>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 14 }}>
                      <Field label="City"><input className="input-field" type="text" value={shipCity} onChange={(e) => setShipCity(e.target.value)} /></Field>
                      <Field label="State"><input className="input-field" type="text" value={shipState} onChange={(e) => setShipState(e.target.value)} /></Field>
                      <Field label="Pincode"><input className="input-field" type="text" value={shipPincode} onChange={(e) => setShipPincode(e.target.value)} /></Field>
                    </div>
                  </div>
                )}

                {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

                <div style={{ display: 'flex', gap: 10, marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? (
                      <><svg className="anim-rotate" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>Saving…</>
                    ) : 'Save changes'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => { setEditing(false); setError(''); populateForm(client); }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* View mode */
            <div className="card" style={{ padding: 28 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Contact details</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {[
                  { label: 'Full name', value: client.name },
                  { label: 'Email', value: client.email || '—' },
                  { label: 'Phone', value: client.phone || '—' },
                  { label: 'Projects', value: String(client._count?.projects ?? client.projects.length) },
                ].map((row) => (
                  <div key={row.label}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{row.label}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{row.value}</div>
                  </div>
                ))}
              </div>

              {(billingStr || shippingStr) && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {billingStr && (
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Billing address</div>
                      <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.6 }}>{billingStr}</div>
                    </div>
                  )}
                  {shippingStr && shippingStr !== billingStr && (
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Shipping address</div>
                      <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.6 }}>{shippingStr}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right col — Projects ────────────────────────── */}
        <div>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Projects</div>
              <span style={{
                background: 'var(--gold-dim)', border: '1px solid var(--gold-border)',
                borderRadius: 999, padding: '2px 9px', fontSize: 11, color: 'var(--gold)', fontWeight: 700,
              }}>
                {client.projects.length}
              </span>
            </div>

            {client.projects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
                  No projects yet for this client.
                </div>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 13 }}
                  onClick={() => router.push('/projects')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New project
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {client.projects.map((p) => {
                  const st = PROJECT_STATUS_COLORS[p.status] ?? PROJECT_STATUS_COLORS.draft;
                  return (
                    <div key={p.id} style={{
                      padding: '10px 12px', borderRadius: 10,
                      border: '1px solid var(--border)', background: 'var(--bg-input)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(p.createdAt)}</div>
                        </div>
                        <div style={{
                          background: st.bg, border: `1px solid ${st.border}`,
                          borderRadius: 999, padding: '3px 9px', fontSize: 11, color: st.color, fontWeight: 600,
                        }}>
                          {st.label}
                        </div>
                      </div>
                      {p.portalToken ? (
                        <CopyLinkButton portalToken={p.portalToken} />
                      ) : (
                        <GenerateLinkButton
                          projectId={p.id}
                          onGenerated={(token) => {
                            setClient((prev) => prev ? {
                              ...prev,
                              projects: prev.projects.map((proj) =>
                                proj.id === p.id ? { ...proj, portalToken: token } : proj
                              ),
                            } : prev);
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
