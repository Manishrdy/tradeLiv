'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, Client, ClientPayload } from '@/lib/api';

/* ─── Budget chips ──────────────────────────────────── */

const BUDGET_CHIPS = [
  { label: 'Up to ₹5L',   min: 0,        max: 500000 },
  { label: '₹5L – ₹15L',  min: 500000,   max: 1500000 },
  { label: '₹15L – ₹30L', min: 1500000,  max: 3000000 },
  { label: '₹30L – ₹50L', min: 3000000,  max: 5000000 },
  { label: '₹50L – ₹1Cr', min: 5000000,  max: 10000000 },
  { label: '₹1Cr+',        min: 10000000, max: 0 },
];

/* ─── Helpers ───────────────────────────────────────── */

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 800,
      background: done ? 'var(--gold)' : active ? 'var(--gold-dim)' : 'var(--bg-input)',
      border: `2px solid ${done || active ? 'var(--gold-border)' : 'var(--border)'}`,
      color: done ? '#fff' : active ? 'var(--gold)' : 'var(--text-muted)',
      transition: 'all 0.2s',
    }}>
      {done ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : n}
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────── */

export default function NewProjectPage() {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 — client selection
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Step 1 — inline new client
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientError, setClientError] = useState('');

  // Step 2 — project details
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [activeChip, setActiveChip] = useState(-1);
  const [stylePreference, setStylePreference] = useState('');
  const [projectError, setProjectError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState<'draft' | 'active'>('draft');

  useEffect(() => {
    api.getClients().then((r) => {
      if (r.data) setClients(r.data);
      setClientsLoading(false);
    });
  }, []);

  const filteredClients = clientSearch.trim()
    ? clients.filter((c) =>
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        (c.email ?? '').toLowerCase().includes(clientSearch.toLowerCase())
      )
    : clients;

  async function handleCreateClient() {
    if (!newClientName.trim()) { setClientError('Client name is required.'); return; }
    setCreatingClient(true);
    setClientError('');
    const payload: ClientPayload = {
      name: newClientName.trim(),
      email: newClientEmail.trim() || undefined,
      phone: newClientPhone.trim() || undefined,
    };
    const r = await api.createClient(payload);
    setCreatingClient(false);
    if (r.error) { setClientError(r.error); return; }
    setClients((prev) => [r.data!, ...prev]);
    setSelectedClient(r.data!);
    setShowNewClient(false);
    setNewClientName(''); setNewClientEmail(''); setNewClientPhone('');
  }

  function handleChipSelect(idx: number) {
    const chip = BUDGET_CHIPS[idx];
    setActiveChip(idx);
    setBudgetMin(chip.min > 0 ? String(chip.min) : '');
    setBudgetMax(chip.max > 0 ? String(chip.max) : '');
  }

  function clearChipIfManual() {
    setActiveChip(-1);
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
    router.push(`/projects/${r.data!.id}`);
  }

  return (
    <div style={{ padding: '36px 40px', maxWidth: 760 }}>

      {/* ── Back ────────────────────────────────────────── */}
      <Link href="/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textDecoration: 'none', marginBottom: 28 }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--gold)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to projects
      </Link>

      {/* ── Step indicator ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
        {[
          { n: 1, label: 'Select Client' },
          { n: 2, label: 'Project Details' },
        ].map((s, i) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <StepDot n={s.n} active={step === s.n} done={step > s.n} />
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: step === s.n ? 'var(--text-primary)' : step > s.n ? 'var(--gold)' : 'var(--text-muted)',
              }}>
                {s.label}
              </span>
            </div>
            {i < 1 && (
              <div style={{ width: 40, height: 1, background: step > s.n ? 'var(--gold-border)' : 'var(--border)', margin: '0 12px' }} />
            )}
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════════════
          STEP 1 — CLIENT SELECTION
      ════════════════════════════════════════════════ */}
      {step === 1 && (
        <div>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 6 }}>
              Select a client
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
              Choose an existing client or create a new one for this project.
            </p>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="input-field"
              type="text"
              placeholder="Search clients…"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </div>

          {/* Client list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, maxHeight: 360, overflowY: 'auto' }}>
            {clientsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>
                <svg className="anim-rotate" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                Loading clients…
              </div>
            ) : filteredClients.length === 0 && !showNewClient ? (
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
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                      border: `1.5px solid ${isSelected ? 'var(--gold-border)' : 'var(--border)'}`,
                      background: isSelected ? 'var(--gold-dim)' : 'var(--bg-input)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(145deg, #e8d5a3, #c9a84c)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, color: '#7a4f0a',
                    }}>
                      {initials(c.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 1 }}>{c.name}</div>
                      {c.email && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.email}</div>}
                    </div>
                    {c._count?.projects !== undefined && (
                      <div style={{
                        background: 'var(--bg-input)', border: '1px solid var(--border)',
                        borderRadius: 999, padding: '2px 9px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600,
                      }}>
                        {c._count.projects} project{c._count.projects !== 1 ? 's' : ''}
                      </div>
                    )}
                    {isSelected && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* New client inline */}
          {!showNewClient ? (
            <button
              onClick={() => setShowNewClient(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                border: '1.5px dashed var(--border-strong)', background: 'transparent',
                color: 'var(--text-muted)', fontSize: 13.5, fontWeight: 600,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--gold-border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--gold)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create a new client
            </button>
          ) : (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>New client</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="form-label">Full Name *</label>
                  <input className="input-field" type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Priya Sharma" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">Email</label>
                    <input className="input-field" type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="priya@example.com" />
                  </div>
                  <div>
                    <label className="form-label">Phone</label>
                    <input className="input-field" type="tel" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="+91 98765 43210" />
                  </div>
                </div>
                {clientError && <div className="error-box">{clientError}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" onClick={handleCreateClient} disabled={creatingClient} style={{ fontSize: 13 }}>
                    {creatingClient ? 'Creating…' : 'Create & Select'}
                  </button>
                  <button className="btn-ghost" onClick={() => { setShowNewClient(false); setClientError(''); }} style={{ fontSize: 13 }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Continue button */}
          <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn-primary"
              disabled={!selectedClient}
              onClick={() => setStep(2)}
              style={{ display: 'flex', alignItems: 'center', gap: 7 }}
            >
              Continue
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {selectedClient && (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <strong style={{ color: 'var(--gold)' }}>{selectedClient.name}</strong> selected
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          STEP 2 — PROJECT DETAILS
      ════════════════════════════════════════════════ */}
      {step === 2 && (
        <div>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 6 }}>
              Project details
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
              For <strong style={{ color: 'var(--text-primary)' }}>{selectedClient?.name}</strong>
            </p>
          </div>

          <div className="card" style={{ padding: 28 }}>

            {/* Project name */}
            <div style={{ marginBottom: 20 }}>
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

            {/* Description */}
            <div style={{ marginBottom: 20 }}>
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

            {/* Budget */}
            <div style={{ marginBottom: 20 }}>
              <label className="form-label">Total Budget</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
                {BUDGET_CHIPS.map((chip, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleChipSelect(i)}
                    style={{
                      border: `1px solid ${activeChip === i ? 'var(--gold-border)' : 'var(--border)'}`,
                      background: activeChip === i ? 'var(--gold-dim)' : 'var(--bg-input)',
                      color: activeChip === i ? 'var(--gold)' : 'var(--text-secondary)',
                      borderRadius: 999, padding: '5px 13px', fontSize: 12.5, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Min (₹)</label>
                  <input
                    className="input-field"
                    type="number"
                    value={budgetMin}
                    onChange={(e) => { setBudgetMin(e.target.value); clearChipIfManual(); }}
                    placeholder="e.g., 500000"
                    min="0"
                  />
                </div>
                <div>
                  <label className="form-label">Max (₹)</label>
                  <input
                    className="input-field"
                    type="number"
                    value={budgetMax}
                    onChange={(e) => { setBudgetMax(e.target.value); clearChipIfManual(); }}
                    placeholder="e.g., 1500000"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Style preference */}
            <div style={{ marginBottom: 8 }}>
              <label className="form-label">Style Preference</label>
              <input
                className="input-field"
                type="text"
                value={stylePreference}
                onChange={(e) => setStylePreference(e.target.value)}
                placeholder="e.g., Modern minimalist with warm wood tones"
              />
            </div>
          </div>

          {projectError && <div className="error-box" style={{ marginTop: 16 }}>{projectError}</div>}

          {/* Actions */}
          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
            <button className="btn-ghost" onClick={() => setStep(1)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn-ghost"
                onClick={() => handleSubmit('draft')}
                disabled={submitting}
              >
                {submitting && submitMode === 'draft' ? 'Saving…' : 'Save as Draft'}
              </button>
              <button
                className="btn-primary"
                onClick={() => handleSubmit('active')}
                disabled={submitting}
              >
                {submitting && submitMode === 'active' ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
