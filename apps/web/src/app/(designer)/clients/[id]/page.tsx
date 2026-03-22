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
          border: '1px solid var(--border-strong)',
          borderRadius: 6, padding: '3px 10px',
          fontSize: 11, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
          color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: 5,
          transition: 'all 0.12s',
        }}
      >
        {loading ? (
          <>
            <svg className="anim-rotate" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
            Generating…
          </>
        ) : (
          <>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Generate link
          </>
        )}
      </button>
      {error && <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 4 }}>{error}</div>}
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
        background: copied ? 'var(--green-dim)' : 'transparent',
        border: `1px solid ${copied ? 'var(--green-border)' : 'var(--border)'}`,
        borderRadius: 6, padding: '3px 10px',
        fontSize: 11, fontWeight: 600, cursor: 'pointer',
        color: copied ? 'var(--green)' : 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: 5,
        transition: 'all 0.12s', flexShrink: 0,
      }}
    >
      {copied ? (
        <>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatAddress(addr?: Address | null) {
  if (!addr) return null;
  return [addr.line1, addr.line2, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
}

/* ── Phone formatting ──────────────────────────────── */

function formatPhoneDisplay(value: string): string {
  const hasPlus = value.startsWith('+');
  const digits = value.replace(/[^\d]/g, '');
  if (hasPlus) {
    if (digits.length <= 1) return `+${digits}`;
    const cc = digits.slice(0, 1);
    const rest = digits.slice(1);
    if (rest.length <= 3) return `+${cc} (${rest}`;
    if (rest.length <= 6) return `+${cc} (${rest.slice(0, 3)}) ${rest.slice(3)}`;
    return `+${cc} (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6, 10)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function PhoneInput({ value, onChange, ...props }: { value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === '+' || raw === '') { onChange(raw); return; }
    onChange(formatPhoneDisplay(raw));
  }
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12 19.79 19.79 0 0 1 1.97 3.32 2 2 0 0 1 3.94 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.99 5.99l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      </span>
      <input className="input-field" type="tel" value={value} onChange={handleChange} style={{ paddingLeft: 34 }} {...props} />
    </div>
  );
}

/* ── Notes section ─────────────────────────────────── */

function NotesSection({ clientId }: { clientId: string }) {
  const STORAGE_KEY = `tradeliv-client-notes-${clientId}`;
  const [notes, setNotes] = useState<{ id: string; text: string; date: string }[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [draft, setDraft] = useState('');

  function saveNotes(updated: typeof notes) {
    setNotes(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  function addNote() {
    if (!draft.trim()) return;
    const note = { id: Date.now().toString(), text: draft.trim(), date: new Date().toISOString() };
    saveNotes([note, ...notes]);
    setDraft('');
  }

  function deleteNote(id: string) {
    saveNotes(notes.filter((n) => n.id !== id));
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Notes</div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: notes.length > 0 ? 16 : 0 }}>
        <textarea
          className="input-field"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note about this client…"
          rows={2}
          style={{ resize: 'vertical', flex: 1 }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(); }}
        />
        <button
          onClick={addNote}
          disabled={!draft.trim()}
          className="btn-primary"
          style={{ alignSelf: 'flex-end', padding: '8px 14px', fontSize: 12 }}
        >
          Add
        </button>
      </div>

      {/* Notes list */}
      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.map((note) => (
            <div key={note.id} style={{
              padding: '10px 13px', borderRadius: 8,
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              position: 'relative',
            }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {note.text}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                  {new Date(note.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <button
                  onClick={() => deleteNote(note.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 2, fontSize: 11,
                    fontFamily: 'inherit', transition: 'color 0.12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#b91c1c')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {notes.length === 0 && !draft && (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>
          No notes yet. Add notes to track communication or preferences.
        </div>
      )}
    </div>
  );
}

const PROJECT_STATUS: Record<string, { bg: string; border: string; color: string; label: string }> = {
  draft:   { bg: 'rgba(0,0,0,0.04)',    border: 'rgba(0,0,0,0.09)',    color: 'var(--text-muted)',   label: 'Draft' },
  active:  { bg: 'var(--green-dim)',     border: 'var(--green-border)',  color: 'var(--green)',        label: 'Active' },
  ordered: { bg: 'rgba(50,80,190,0.07)', border: 'rgba(50,80,190,0.18)', color: '#3850be',            label: 'Ordered' },
  closed:  { bg: 'rgba(0,0,0,0.04)',    border: 'rgba(0,0,0,0.09)',    color: 'var(--text-muted)',   label: 'Closed' },
};

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

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [billLine1, setBillLine1] = useState('');
  const [billLine2, setBillLine2] = useState('');
  const [billCity, setBillCity] = useState('');
  const [billState, setBillState] = useState('');
  const [billZip, setBillZip] = useState('');
  const [shipLine1, setShipLine1] = useState('');
  const [shipLine2, setShipLine2] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipState, setShipState] = useState('');
  const [shipZip, setShipZip] = useState('');
  const [sameAddress, setSameAddress] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.getClient(id).then((r) => {
      if (r.data) { setClient(r.data); populateForm(r.data); }
      setLoading(false);
    });
  }, [id]);

  function populateForm(c: ClientDetail) {
    setName(c.name);
    setEmail(c.email ?? '');
    setPhone(c.phone ?? '');
    const b = c.billingAddress as Address | null;
    setBillLine1(b?.line1 ?? ''); setBillLine2(b?.line2 ?? '');
    setBillCity(b?.city ?? ''); setBillState(b?.state ?? ''); setBillZip(b?.zip ?? '');
    const s = c.shippingAddress as Address | null;
    setShipLine1(s?.line1 ?? ''); setShipLine2(s?.line2 ?? '');
    setShipCity(s?.city ?? ''); setShipState(s?.state ?? ''); setShipZip(s?.zip ?? '');
    setSameAddress(JSON.stringify(b) === JSON.stringify(s));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Client name is required.'); return; }
    setSaving(true); setError('');

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

    const result = await api.updateClient(id, payload);
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    const fresh = await api.getClient(id);
    if (fresh.data) setClient(fresh.data);
    setEditing(false);
  }

  if (loading) {
    return (
      <div style={{ padding: '40px 44px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13.5 }}>
          <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading client…
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ padding: '40px 44px' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 8 }}>Client not found.</div>
        <Link href="/clients" style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>← Back to clients</Link>
      </div>
    );
  }

  const billingStr = formatAddress(client.billingAddress as Address | null);
  const shippingStr = formatAddress(client.shippingAddress as Address | null);

  return (
    <div style={{ padding: '40px 44px', maxWidth: 900 }}>

      {/* ── Back ────────────────────────────────────────── */}
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

      {/* ── Profile header ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, color: 'var(--text-secondary)',
            letterSpacing: '0.02em',
          }}>
            {initials(client.name)}
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 3 }}>
              {client.name}
            </h1>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Client since {formatDate(client.createdAt)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {!editing && (
            <>
              <button className="btn-ghost" onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
              <button
                onClick={() => { setConfirmDelete(true); setDeleteError(''); }}
                style={{
                  border: '1px solid rgba(180,30,30,0.20)', borderRadius: 8,
                  background: 'transparent', color: '#b91c1c',
                  padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 7,
                  transition: 'all 0.12s',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                </svg>
                Delete
              </button>
            </>
          )}
        </div>

        {/* Confirm delete dialog */}
        {confirmDelete && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div className="card" style={{ width: 400, padding: '28px', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                  background: 'rgba(180,30,30,0.07)', border: '1px solid rgba(180,30,30,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 5 }}>
                    Delete {client.name}?
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                    This will permanently delete the client record. All associated projects must be deleted first.
                  </div>
                </div>
              </div>

              {deleteError && (
                <div className="error-box" style={{ marginBottom: 16 }}>{deleteError}</div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  className="btn-ghost"
                  onClick={() => { setConfirmDelete(false); setDeleteError(''); }}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true);
                    setDeleteError('');
                    const result = await api.deleteClient(id);
                    setDeleting(false);
                    if (result.error) { setDeleteError(result.error); return; }
                    router.push('/clients');
                  }}
                  style={{
                    border: 'none', borderRadius: 8,
                    background: '#b91c1c', color: '#fff',
                    padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    opacity: deleting ? 0.7 : 1,
                  }}
                >
                  {deleting ? 'Deleting…' : 'Delete client'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18, alignItems: 'start' }}>

        {/* ── Left col ────────────────────────────────────── */}
        <div>

          {/* Edit form */}
          {editing ? (
            <div className="card" style={{ padding: 28 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Edit client details</div>
              <form onSubmit={handleSave} noValidate>
                <SectionHeading>Contact information</SectionHeading>
                <Field label="Full Name *">
                  <input className="input-field" type="text" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Email Address">
                    <input className="input-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </Field>
                  <Field label="Phone Number">
                    <PhoneInput value={phone} onChange={setPhone} placeholder="+1 (555) 867-5309" />
                  </Field>
                </div>

                <SectionHeading>Billing address</SectionHeading>
                <Field label="Address Line 1">
                  <input className="input-field" type="text" value={billLine1} onChange={(e) => setBillLine1(e.target.value)} />
                </Field>
                <Field label="Address Line 2">
                  <input className="input-field" type="text" value={billLine2} onChange={(e) => setBillLine2(e.target.value)} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: 12 }}>
                  <Field label="City"><input className="input-field" type="text" value={billCity} onChange={(e) => setBillCity(e.target.value)} /></Field>
                  <Field label="State"><input className="input-field" type="text" value={billState} onChange={(e) => setBillState(e.target.value)} /></Field>
                  <Field label="ZIP Code"><input className="input-field" type="text" value={billZip} onChange={(e) => setBillZip(e.target.value)} /></Field>
                </div>

                <SectionHeading>Shipping address</SectionHeading>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 18 }}>
                  <div onClick={() => {
                    const next = !sameAddress;
                    setSameAddress(next);
                    if (next) {
                      setTimeout(() => { setShipLine1(billLine1); setShipLine2(billLine2); setShipCity(billCity); setShipState(billState); setShipZip(billZip); }, 100);
                    } else {
                      setShipLine1(''); setShipLine2(''); setShipCity(''); setShipState(''); setShipZip('');
                    }
                  }} style={{ width: 38, height: 20, borderRadius: 999, background: sameAddress ? '#111111' : 'var(--border-strong)', position: 'relative', transition: 'background 0.2s ease', cursor: 'pointer', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: 3, left: sameAddress ? 19 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s cubic-bezier(0.22,1,0.36,1)' }} />
                  </div>
                  <div>
                    <span style={{ fontSize: 13.5, color: 'var(--text-secondary)', fontWeight: 500 }}>Same as billing address</span>
                    {sameAddress && billLine1 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {[billLine1, billCity, billState].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                </label>
                {!sameAddress && (
                  <div>
                    <Field label="Address Line 1"><input className="input-field" type="text" value={shipLine1} onChange={(e) => setShipLine1(e.target.value)} /></Field>
                    <Field label="Address Line 2"><input className="input-field" type="text" value={shipLine2} onChange={(e) => setShipLine2(e.target.value)} /></Field>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: 12 }}>
                      <Field label="City"><input className="input-field" type="text" value={shipCity} onChange={(e) => setShipCity(e.target.value)} /></Field>
                      <Field label="State"><input className="input-field" type="text" value={shipState} onChange={(e) => setShipState(e.target.value)} /></Field>
                      <Field label="ZIP Code"><input className="input-field" type="text" value={shipZip} onChange={(e) => setShipZip(e.target.value)} /></Field>
                    </div>
                  </div>
                )}

                {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

                <div style={{ display: 'flex', gap: 10, marginTop: 22, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? (
                      <><svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>Saving…</>
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
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Contact details</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {[
                  { label: 'Full name', value: client.name },
                  { label: 'Email', value: client.email || '—' },
                  { label: 'Phone', value: client.phone || '—' },
                  { label: 'Projects', value: String(client._count?.projects ?? client.projects.length) },
                ].map((row) => (
                  <div key={row.label}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{row.label}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{row.value}</div>
                  </div>
                ))}
              </div>

              {(billingStr || shippingStr) && (
                <div style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {billingStr && (
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Billing address</div>
                      <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.6 }}>{billingStr}</div>
                    </div>
                  )}
                  {shippingStr && shippingStr !== billingStr && (
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Shipping address</div>
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
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Projects</div>
              <span style={{
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 999, padding: '2px 9px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600,
              }}>
                {client.projects.length}
              </span>
            </div>

            {client.projects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.55 }}>
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
                  const st = PROJECT_STATUS[p.status] ?? PROJECT_STATUS.draft;
                  return (
                    <div key={p.id} style={{
                      padding: '10px 13px', borderRadius: 9,
                      border: '1px solid var(--border)', background: 'var(--bg-input)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <Link
                            href={`/projects/${p.id}`}
                            style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 1, textDecoration: 'none', display: 'block' }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)')}
                          >{p.name}</Link>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(p.createdAt)}</div>
                        </div>
                        <div style={{
                          background: st.bg, border: `1px solid ${st.border}`,
                          borderRadius: 999, padding: '2px 9px', fontSize: 10.5, color: st.color, fontWeight: 600,
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

          {/* ── Notes section ─────────────────────────── */}
          <NotesSection clientId={id} />
        </div>
      </div>
    </div>
  );
}
