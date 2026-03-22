'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, Client, ClientPayload } from '@/lib/api';

/* ── Constants ─────────────────────────────────────── */

const BUDGET_CHIPS = [
  { label: 'Under $10K',    min: 0,      max: 10000 },
  { label: '$10K – $25K',   min: 10000,  max: 25000 },
  { label: '$25K – $50K',   min: 25000,  max: 50000 },
  { label: '$50K – $100K',  min: 50000,  max: 100000 },
  { label: '$100K – $250K', min: 100000, max: 250000 },
  { label: '$250K+',        min: 250000, max: 0 },
];

const STYLE_PRESETS = [
  { label: 'Modern Minimalist', icon: '◻️', desc: 'Clean lines, neutral tones, functional spaces' },
  { label: 'Scandinavian', icon: '🌿', desc: 'Light wood, organic textures, cozy simplicity' },
  { label: 'Industrial', icon: '🏗️', desc: 'Raw materials, exposed elements, urban edge' },
  { label: 'Mid-Century Modern', icon: '🪑', desc: 'Retro forms, warm woods, bold accents' },
  { label: 'Contemporary Luxury', icon: '✨', desc: 'Rich materials, elegant finishes, refined details' },
  { label: 'Bohemian', icon: '🎨', desc: 'Eclectic patterns, layered textures, global influences' },
  { label: 'Japandi', icon: '🎋', desc: 'Japanese simplicity meets Scandinavian warmth' },
  { label: 'Art Deco', icon: '💎', desc: 'Geometric patterns, bold glamour, rich colors' },
];

const STORAGE_KEY = 'tradeliv-new-project-draft';

/* ── Helpers ───────────────────────────────────────── */

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

/* ── Labeled step indicator ────────────────────────── */

function StepIndicator({ step }: { step: 1 | 2 }) {
  const steps = [
    { n: 1, label: 'Select Client' },
    { n: 2, label: 'Project Details' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 36 }} role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={2}>
      {steps.map((s, i) => {
        const isDone = step > s.n;
        const isActive = step === s.n;
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: isDone ? '#111111' : isActive ? '#fff' : 'var(--bg-input)',
                border: `2px solid ${isDone ? '#111111' : isActive ? '#111111' : 'var(--border)'}`,
                color: isDone ? '#fff' : isActive ? '#111111' : 'var(--text-muted)',
                transition: 'all 0.25s',
              }}>
                {isDone ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : s.n}
              </div>
              <div>
                <div style={{
                  fontSize: 13, fontWeight: isActive ? 700 : isDone ? 600 : 500,
                  color: isActive ? 'var(--text-primary)' : isDone ? 'var(--text-secondary)' : 'var(--text-muted)',
                  letterSpacing: '-0.01em',
                }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>
                  {isDone ? 'Completed' : isActive ? 'In progress' : 'Upcoming'}
                </div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width: 48, height: 2, borderRadius: 999,
                background: isDone ? '#111111' : 'var(--border)',
                margin: '0 16px', transition: 'background 0.3s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── New Client Drawer ─────────────────────────────── */

function NewClientDrawer({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (client: Client) => void;
}) {
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Client name is required.'); return; }
    setLoading(true); setError('');
    const payload: ClientPayload = {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    };
    const r = await api.createClient(payload);
    setLoading(false);
    if (r.error) { setError(r.error); return; }
    onCreated(r.data!);
    setName(''); setEmail(''); setPhone('');
  }

  if (!open) return null;

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <div
        className="anim-fade-up"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
          zIndex: 51, background: '#fff', boxShadow: '-8px 0 30px rgba(0,0,0,0.1)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>New Client</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '24px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="form-label">Full Name *</label>
            <input className="input-field" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" autoFocus />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input className="input-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@example.com" />
          </div>
          <div>
            <label className="form-label">Phone</label>
            <input className="input-field" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
          </div>
          {error && <div className="error-box">{error}</div>}
          <div style={{ marginTop: 'auto', display: 'flex', gap: 10, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Creating…' : 'Create & Select'}
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   New Project Page
   ══════════════════════════════════════════════════════ */

export default function NewProjectPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);

  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);

  const [projectName, setProjectName]     = useState('');
  const [description, setDescription]     = useState('');
  const [budgetMin, setBudgetMin]         = useState('');
  const [budgetMax, setBudgetMax]         = useState('');
  const [activeChip, setActiveChip]       = useState(-1);
  const [stylePreference, setStylePreference] = useState('');
  const [projectError, setProjectError]   = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [submitMode, setSubmitMode]       = useState<'draft' | 'active'>('draft');
  const [lastSaved, setLastSaved]         = useState<string | null>(null);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    api.getClients().then((r) => {
      if (r.data) setClients(r.data);
      setClientsLoading(false);
    });

    // Restore draft from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.projectName) setProjectName(draft.projectName);
        if (draft.description) setDescription(draft.description);
        if (draft.budgetMin) setBudgetMin(draft.budgetMin);
        if (draft.budgetMax) setBudgetMax(draft.budgetMax);
        if (draft.stylePreference) setStylePreference(draft.stylePreference);
        if (draft.activeChip !== undefined) setActiveChip(draft.activeChip);
      }
    } catch {}
  }, []);

  /* ── Auto-save to localStorage ───────────────────── */
  const autoSave = useCallback(() => {
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const draft = { projectName, description, budgetMin, budgetMax, stylePreference, activeChip };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      setLastSaved(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
  }, [projectName, description, budgetMin, budgetMax, stylePreference, activeChip]);

  useEffect(() => { if (step === 2) autoSave(); }, [projectName, description, budgetMin, budgetMax, stylePreference, step, autoSave]);

  const filteredClients = clientSearch.trim()
    ? clients.filter((c) =>
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        (c.email ?? '').toLowerCase().includes(clientSearch.toLowerCase())
      )
    : clients;

  function handleChipSelect(idx: number) {
    const chip = BUDGET_CHIPS[idx];
    setActiveChip(idx);
    setBudgetMin(chip.min > 0 ? String(chip.min) : '');
    setBudgetMax(chip.max > 0 ? String(chip.max) : '');
  }

  async function handleSubmit(status: 'draft' | 'active') {
    if (!projectName.trim()) { setProjectError('Project name is required.'); return; }
    if (!selectedClient) { setProjectError('Please select a client.'); return; }

    setSubmitMode(status);
    setSubmitting(true);
    setProjectError('');

    const r = await api.createProject({
      clientId: selectedClient.id,
      name: projectName.trim(),
      description: description.trim() || undefined,
      budgetMin: budgetMin ? Number(budgetMin) : undefined,
      budgetMax: budgetMax ? Number(budgetMax) : undefined,
      stylePreference: stylePreference.trim() || undefined,
      status,
    });

    setSubmitting(false);
    if (r.error) { setProjectError(r.error); return; }
    // Clear draft
    localStorage.removeItem(STORAGE_KEY);
    router.push(`/projects/${r.data!.id}`);
  }

  return (
    <div style={{ padding: '40px 44px', maxWidth: 720 }}>

      {/* ── Back ──────────────────────────────────────── */}
      <Link
        href="/projects"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, textDecoration: 'none', marginBottom: 28, transition: 'color 0.12s' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to projects
      </Link>

      {/* ── Step indicator (labeled) ───────────────────── */}
      <StepIndicator step={step} />

      {/* ═══ STEP 1 — CLIENT SELECTION ═══════════════ */}
      {step === 1 && (
        <div>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 6 }}>
              Select a client
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
              Choose an existing client or create a new one for this project.
            </p>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="input-field"
              type="text"
              placeholder="Search clients…"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              style={{ paddingLeft: 34, width: '100%' }}
            />
          </div>

          {/* Client list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, maxHeight: 340, overflowY: 'auto' }}>
            {clientsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>
                <svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                Loading clients…
              </div>
            ) : filteredClients.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {clientSearch ? 'No clients match your search.' : 'No clients yet.'}
              </div>
            ) : (
              filteredClients.map((c) => {
                const isSelected = selectedClient?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedClient(isSelected ? null : c)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 13,
                      padding: '11px 15px', borderRadius: 9, cursor: 'pointer',
                      border: `1px solid ${isSelected ? '#111111' : 'var(--border)'}`,
                      background: isSelected ? '#111111' : 'var(--bg-input)',
                      transition: 'all 0.12s',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: isSelected ? 'rgba(255,255,255,0.12)' : 'var(--bg-card)',
                      border: `1px solid ${isSelected ? 'rgba(255,255,255,0.12)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: isSelected ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)',
                    }}>
                      {initials(c.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: isSelected ? '#fff' : 'var(--text-primary)', marginBottom: 1 }}>{c.name}</div>
                      {c.email && <div style={{ fontSize: 12, color: isSelected ? 'rgba(255,255,255,0.50)' : 'var(--text-muted)' }}>{c.email}</div>}
                    </div>
                    {c._count?.projects !== undefined && (
                      <div style={{
                        background: isSelected ? 'rgba(255,255,255,0.09)' : 'var(--bg-card)',
                        border: `1px solid ${isSelected ? 'rgba(255,255,255,0.10)' : 'var(--border)'}`,
                        borderRadius: 999, padding: '2px 9px', fontSize: 11,
                        color: isSelected ? 'rgba(255,255,255,0.65)' : 'var(--text-muted)', fontWeight: 600,
                      }}>
                        {c._count.projects} project{c._count.projects !== 1 ? 's' : ''}
                      </div>
                    )}
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* New client — opens drawer */}
          <button
            onClick={() => setShowNewClient(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '11px 15px', borderRadius: 9, cursor: 'pointer',
              border: '1px dashed var(--border-strong)', background: 'transparent',
              color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
              transition: 'all 0.12s', fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-input)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create a new client
          </button>

          {/* Continue */}
          <div style={{ marginTop: 28, paddingTop: 22, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn-primary"
              disabled={!selectedClient}
              onClick={() => setStep(2)}
              style={{ display: 'flex', alignItems: 'center', gap: 7 }}
            >
              Continue
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {selectedClient && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text-secondary)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <strong>{selectedClient.name}</strong> selected
            </div>
          )}
        </div>
      )}

      {/* ═══ STEP 2 — PROJECT DETAILS ════════════════ */}
      {step === 2 && (
        <div>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 6 }}>
              Project details
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0 }}>
                For <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{selectedClient?.name}</strong>
              </p>
              {lastSaved && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Draft saved {lastSaved}
                </span>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 28 }}>

            <div style={{ marginBottom: 18 }}>
              <label className="form-label">Project Name *</label>
              <input
                className="input-field"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., Bandra West — 3BHK Renovation"
                autoFocus
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label className="form-label">Description</label>
              <textarea
                className="input-field"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief overview of the project scope…"
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label className="form-label">Total Budget</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {BUDGET_CHIPS.map((chip, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleChipSelect(i)}
                    style={{
                      border: `1px solid ${activeChip === i ? '#111111' : 'var(--border)'}`,
                      background: activeChip === i ? '#111111' : 'var(--bg-input)',
                      color: activeChip === i ? '#fff' : 'var(--text-secondary)',
                      borderRadius: 999, padding: '5px 13px', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit',
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Min ($)</label>
                  <input
                    className="input-field"
                    type="number"
                    value={budgetMin}
                    onChange={(e) => { setBudgetMin(e.target.value); setActiveChip(-1); }}
                    placeholder="e.g., 500000"
                    min="0"
                  />
                </div>
                <div>
                  <label className="form-label">Max ($)</label>
                  <input
                    className="input-field"
                    type="number"
                    value={budgetMax}
                    onChange={(e) => { setBudgetMax(e.target.value); setActiveChip(-1); }}
                    placeholder="e.g., 1500000"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* ── Style picker with visual presets ────── */}
            <div>
              <label className="form-label">Style Preference</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
                {STYLE_PRESETS.map((s) => {
                  const isActive = stylePreference === s.label;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setStylePreference(isActive ? '' : s.label)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 13px', borderRadius: 9,
                        border: `1.5px solid ${isActive ? '#111111' : 'var(--border)'}`,
                        background: isActive ? 'rgba(17,17,17,0.04)' : 'transparent',
                        cursor: 'pointer', fontFamily: 'inherit',
                        textAlign: 'left', transition: 'all 0.12s',
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{s.icon}</span>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: isActive ? 700 : 600, color: isActive ? '#111' : 'var(--text-primary)', marginBottom: 1 }}>
                          {s.label}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.3 }}>
                          {s.desc}
                        </div>
                      </div>
                      {isActive && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginLeft: 'auto' }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              <input
                className="input-field"
                type="text"
                value={stylePreference}
                onChange={(e) => setStylePreference(e.target.value)}
                placeholder="Or type a custom style…"
              />
            </div>
          </div>

          {projectError && <div className="error-box" style={{ marginTop: 14 }}>{projectError}</div>}

          {/* Actions */}
          <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
            <button className="btn-ghost" onClick={() => setStep(1)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" onClick={() => handleSubmit('draft')} disabled={submitting}>
                {submitting && submitMode === 'draft' ? 'Saving…' : 'Save as Draft'}
              </button>
              <button className="btn-primary" onClick={() => handleSubmit('active')} disabled={submitting}>
                {submitting && submitMode === 'active' ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New client slide-out drawer ────────────── */}
      <NewClientDrawer
        open={showNewClient}
        onClose={() => setShowNewClient(false)}
        onCreated={(client) => {
          setClients((prev) => [client, ...prev]);
          setSelectedClient(client);
          setShowNewClient(false);
        }}
      />
    </div>
  );
}
