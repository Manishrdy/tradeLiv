'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

type Phase = 1 | 2 | 'success';

const DESIGNER_SPECS = ['Residential', 'Commercial', 'Hospitality', 'Retail', 'Healthcare', 'Luxury Villas', 'Offices', 'Show Homes'];

const INPUT: React.CSSProperties = {
  display: 'block',
  width: '100%',
  background: '#fff',
  border: '1.5px solid #E4E1DC',
  borderRadius: 10,
  padding: '12px 14px',
  fontSize: 14,
  color: '#0F0F0F',
  fontFamily: 'inherit',
  outline: 'none',
  letterSpacing: '-0.01em',
  transition: 'border-color 0.14s',
};

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: '#B0ADA8',
  marginBottom: 7,
};

const FIELD_ERROR: React.CSSProperties = {
  fontSize: 12, color: '#ef4444', marginTop: 5, letterSpacing: '-0.01em',
};

/* ── Icons ─────────────────────────────────────────── */

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CheckIcon({ size = 10, color = '#22c55e' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5L6.5 12L13 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Step indicator ────────────────────────────────── */

function StepIndicator({ phase }: { phase: Phase }) {
  const step = phase === 'success' ? 2 : (phase as number);
  return (
    <div style={{ marginBottom: 44 }} role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={2} aria-label={`Step ${step} of 2`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
          color: step >= 1 ? '#0F0F0F' : '#C8C5BF', transition: 'color 0.3s',
        }}>01 <span style={{ fontWeight: 400, fontSize: 10, color: '#B0ADA8' }}>Account</span></span>
        <span style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
          color: step >= 2 ? '#0F0F0F' : '#C8C5BF', transition: 'color 0.3s',
        }}>02 <span style={{ fontWeight: 400, fontSize: 10, color: step >= 2 ? '#B0ADA8' : '#D4D1CC' }}>Studio</span></span>
      </div>
      <div style={{ height: 1.5, background: '#E8E5E0', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', background: '#0F0F0F', borderRadius: 999,
          width: step === 1 ? '50%' : '100%',
          transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)',
        }} />
      </div>
    </div>
  );
}

/* ── Password requirements checklist ───────────────── */

function PasswordChecklist({ password, confirmPw, showMatch }: { password: string; confirmPw: string; showMatch: boolean }) {
  const rules = useMemo(() => [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Contains a number', met: /\d/.test(password) },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Contains special character', met: /[^A-Za-z0-9]/.test(password) },
  ], [password]);

  if (!password) return null;

  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }} aria-label="Password requirements">
      {rules.map((r) => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: r.met ? '#22c55e' : '#B0ADA8', transition: 'color 0.2s' }}>
          {r.met
            ? <CheckIcon size={10} color="#22c55e" />
            : <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid #D4D1CC' }} />
          }
          {r.label}
        </div>
      ))}
      {showMatch && confirmPw && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: password === confirmPw ? '#22c55e' : '#ef4444', transition: 'color 0.2s' }}>
          {password === confirmPw
            ? <CheckIcon size={10} color="#22c55e" />
            : <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid #ef4444' }} />
          }
          Passwords match
        </div>
      )}
    </div>
  );
}

/* ── Searchable multi-select for specializations ───── */

function SpecSelect({ specs, onToggle }: { specs: string[]; onToggle: (v: string) => void }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = DESIGNER_SPECS.filter((s) => s.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Selected chips */}
      {specs.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {specs.map((s) => (
            <span key={s} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px 4px 12px',
              background: '#0F0F0F', color: '#fff', borderRadius: 999,
              fontSize: 12, fontWeight: 500, letterSpacing: '-0.01em',
            }}>
              {s}
              <button type="button" onClick={() => onToggle(s)}
                aria-label={`Remove ${s}`}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '0 2px', fontSize: 14, lineHeight: 1, display: 'flex' }}>
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <input
        type="text"
        placeholder={specs.length ? 'Add more…' : 'Search specializations…'}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setOpen(true)}
        aria-label="Search specializations"
        aria-expanded={open}
        role="combobox"
        aria-controls="spec-listbox"
        style={{ ...INPUT, borderColor: open ? '#0F0F0F' : undefined }}
      />

      {/* Dropdown */}
      {open && (
        <div
          id="spec-listbox"
          role="listbox"
          aria-label="Specializations"
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
            marginTop: 4, background: '#fff', border: '1.5px solid #E4E1DC',
            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            maxHeight: 200, overflowY: 'auto',
          }}
        >
          {filtered.length === 0 && (
            <div style={{ padding: '12px 14px', fontSize: 13, color: '#B0ADA8' }}>No results</div>
          )}
          {filtered.map((s) => {
            const active = specs.includes(s);
            return (
              <button
                key={s} type="button"
                role="option"
                aria-selected={active}
                onClick={() => { onToggle(s); setSearch(''); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 14px',
                  background: active ? 'rgba(15,15,15,0.04)' : 'transparent',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13, color: active ? '#0F0F0F' : '#6B6B6B',
                  fontWeight: active ? 600 : 400,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(15,15,15,0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = active ? 'rgba(15,15,15,0.04)' : 'transparent')}
              >
                {s}
                {active && <CheckIcon size={12} color="#0F0F0F" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════ */

export default function SignupPage() {
  const router = useRouter();
  const [phase,   setPhase]   = useState<Phase>(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [showPw,  setShowPw]  = useState(false);

  // Phase 1
  const [fullName,  setFullName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [touched1,  setTouched1]  = useState<Record<string, boolean>>({});

  // Phase 2
  const [businessName, setBusinessName] = useState('');
  const [phone,        setPhone]        = useState('');
  const [experience,   setExperience]   = useState('');
  const [specs,        setSpecs]        = useState<string[]>([]);
  const [portfolio,    setPortfolio]    = useState('');

  // Success
  const [progress, setProgress] = useState(0);

  function toggleSpec(val: string) {
    setSpecs((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]);
  }

  /* ── Inline validations (Phase 1) ─────────────────── */
  const nameErr    = touched1.fullName && !fullName.trim() ? 'Full name is required.' : '';
  const emailErr   = touched1.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address.' : '';
  const pwErr      = touched1.password && password.length > 0 && password.length < 8 ? 'At least 8 characters required.' : '';
  const confirmErr = touched1.confirmPw && confirmPw && password !== confirmPw ? 'Passwords do not match.' : '';

  /* ── Password strength ───────────────────────────── */
  const pwChecks = [
    password.length >= 8,
    /\d/.test(password),
    /[A-Z]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const pwStrength = pwChecks.filter(Boolean).length;
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][pwStrength] ?? '';
  const strengthColor = ['transparent', '#ef4444', '#f97316', '#eab308', '#22c55e'][pwStrength] ?? 'transparent';

  function validateP1(): string | null {
    if (!fullName.trim())                            return 'Full name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Valid email required.';
    if (password.length < 8)                         return 'Password must be at least 8 characters.';
    if (password !== confirmPw)                      return 'Passwords do not match.';
    return null;
  }

  function handleP1(e: React.FormEvent) {
    e.preventDefault();
    setTouched1({ fullName: true, email: true, password: true, confirmPw: true });
    const err = validateP1();
    if (err) { setError(err); return; }
    setError('');
    setPhase(2);
  }

  async function handleP2(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await api.signupDesigner({ fullName, email, password, businessName, phone });
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    setPhase('success');
  }

  async function handleSkip() {
    setLoading(true);
    setError('');
    const result = await api.signupDesigner({ fullName, email, password });
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    setPhase('success');
  }

  /* ── Success redirect ────────────────────────────── */
  useEffect(() => {
    if (phase !== 'success') return;
    let p = 0;
    const iv = setInterval(() => {
      p += 1.6;
      setProgress(Math.min(p, 100));
      if (p >= 100) { clearInterval(iv); router.push('/dashboard'); }
    }, 40);
    return () => clearInterval(iv);
  }, [phase, router]);

  /* ── Page wrapper ─────────────────────────────────── */
  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#FAFAF8',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
  };

  /* ══ Success screen with onboarding prompt ══════════ */
  if (phase === 'success') {
    return (
      <div style={pageStyle}>
        <div className="anim-scale-in" style={{ textAlign: 'center', padding: 24, maxWidth: 380 }}>
          {/* Checkmark */}
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#0F0F0F',
            margin: '0 auto 28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
              <path d="M8 16.5L13 21.5L24 10.5" stroke="#fff" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="50"
                style={{ animation: 'checkStroke 0.6s ease-out 0.1s both' }}
              />
            </svg>
          </div>

          <h2 style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-0.04em', color: '#0F0F0F', marginBottom: 8 }}>
            Welcome to Tradeliv, {fullName.split(' ')[0]}!
          </h2>
          <p style={{ fontSize: 14, color: '#8C8984', marginBottom: 32, letterSpacing: '-0.01em', lineHeight: 1.5 }}>
            Your studio is ready. Here&apos;s what you can do first:
          </p>

          {/* Onboarding quick-start cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 36, textAlign: 'left' }}>
            {[
              { icon: '1', title: 'Add your first client', desc: 'Start building your client directory' },
              { icon: '2', title: 'Create a project', desc: 'Set up room briefs and budgets' },
              { icon: '3', title: 'Browse the catalog', desc: 'Discover products for your projects' },
            ].map((item) => (
              <div key={item.icon} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                background: '#fff', border: '1px solid #E8E5E0', borderRadius: 10,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#F3F2EF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#0F0F0F', flexShrink: 0,
                }}>
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0F0F0F', letterSpacing: '-0.01em' }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: '#B0ADA8', marginTop: 2 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <p style={{ fontSize: 12, color: '#B0ADA8', marginBottom: 10, letterSpacing: '-0.01em' }}>
            Taking you to your studio…
          </p>
          <div style={{ height: 1.5, background: '#E8E5E0', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: '#0F0F0F', borderRadius: 999,
              width: `${progress}%`, transition: 'width 0.04s linear',
            }} />
          </div>
        </div>
      </div>
    );
  }

  /* ══ Phase 1 ════════════════════════════════════════ */
  if (phase === 1) {
    return (
      <div style={pageStyle}>
        <div className="anim-fade-up" style={{ width: '100%', maxWidth: 380 }}>

          <div style={{ marginBottom: 48 }}>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', color: '#0F0F0F' }}>Tradeliv</span>
          </div>

          <StepIndicator phase={phase} />

          <div style={{ marginBottom: 44 }}>
            <h1 style={{ fontSize: 40, fontWeight: 300, letterSpacing: '-0.05em', color: '#0F0F0F', lineHeight: 1.05, marginBottom: 14 }}>
              Create your account.
            </h1>
            <p style={{ fontSize: 14, color: '#8C8984', letterSpacing: '-0.01em' }}>
              Join trade professionals on Tradeliv.
            </p>
          </div>

          <form onSubmit={handleP1} noValidate aria-label="Create your account - step 1">
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="signup-name" style={LABEL}>Full Name</label>
              <input
                id="signup-name"
                type="text" placeholder="Alexandra Chen" value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={() => setTouched1((t) => ({ ...t, fullName: true }))}
                autoComplete="name" autoFocus
                aria-required="true"
                aria-invalid={!!nameErr}
                aria-describedby={nameErr ? 'signup-name-error' : undefined}
                style={{ ...INPUT, borderColor: nameErr ? '#ef4444' : undefined }}
                onFocus={(e) => (e.target.style.borderColor = nameErr ? '#ef4444' : '#0F0F0F')}
              />
              {nameErr && <p id="signup-name-error" role="alert" style={FIELD_ERROR}>{nameErr}</p>}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label htmlFor="signup-email" style={LABEL}>Email Address</label>
              <input
                id="signup-email"
                type="email" placeholder="alex@yourstudio.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched1((t) => ({ ...t, email: true }))}
                autoComplete="email"
                aria-required="true"
                aria-invalid={!!emailErr}
                aria-describedby={emailErr ? 'signup-email-error' : undefined}
                style={{ ...INPUT, borderColor: emailErr ? '#ef4444' : undefined }}
                onFocus={(e) => (e.target.style.borderColor = emailErr ? '#ef4444' : '#0F0F0F')}
              />
              {emailErr && <p id="signup-email-error" role="alert" style={FIELD_ERROR}>{emailErr}</p>}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label htmlFor="signup-password" style={LABEL}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="signup-password"
                  type={showPw ? 'text' : 'password'} placeholder="Min. 8 characters" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched1((t) => ({ ...t, password: true }))}
                  autoComplete="new-password"
                  aria-required="true"
                  aria-describedby="signup-pw-strength"
                  style={{ ...INPUT, paddingRight: 44 }}
                  onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#C8C5BF', display: 'flex', alignItems: 'center', padding: 0 }}>
                  <EyeIcon open={showPw} />
                </button>
              </div>
              {/* Strength bar + label */}
              {password.length > 0 && (
                <div id="signup-pw-strength">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                      {[1, 2, 3, 4].map((n) => (
                        <div key={n} style={{
                          flex: 1, height: 3, borderRadius: 999,
                          background: n <= pwStrength ? strengthColor : '#E4E1DC',
                          transition: 'background 0.25s',
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: strengthColor, minWidth: 40, letterSpacing: '-0.01em' }}>
                      {strengthLabel}
                    </span>
                  </div>
                  {/* Requirements checklist */}
                  <PasswordChecklist password={password} confirmPw={confirmPw} showMatch={false} />
                </div>
              )}
            </div>

            <div style={{ marginBottom: 32 }}>
              <label htmlFor="signup-confirm" style={LABEL}>Confirm Password</label>
              <input
                id="signup-confirm"
                type={showPw ? 'text' : 'password'} placeholder="Re-enter password" value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                onBlur={() => setTouched1((t) => ({ ...t, confirmPw: true }))}
                autoComplete="new-password"
                aria-required="true"
                aria-invalid={!!confirmErr}
                aria-describedby={confirmErr ? 'signup-confirm-error' : undefined}
                style={{ ...INPUT, borderColor: confirmErr ? '#ef4444' : undefined }}
                onFocus={(e) => (e.target.style.borderColor = confirmErr ? '#ef4444' : '#0F0F0F')}
              />
              {confirmErr && <p id="signup-confirm-error" role="alert" style={FIELD_ERROR}>{confirmErr}</p>}
              {/* Show match status inline */}
              {confirmPw && !confirmErr && password === confirmPw && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 12, color: '#22c55e' }}>
                  <CheckIcon size={10} color="#22c55e" /> Passwords match
                </div>
              )}
            </div>

            {error && (
              <div role="alert" style={{
                background: 'rgba(185,28,28,0.04)', border: '1px solid rgba(185,28,28,0.12)',
                borderRadius: 8, padding: '10px 13px', fontSize: 13, color: '#b91c1c',
                marginBottom: 16, letterSpacing: '-0.01em',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '13px 0',
                background: '#0F0F0F', color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.14s, transform 0.12s',
              }}
              onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#1A1A1A'; b.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#0F0F0F'; b.style.transform = 'translateY(0)'; }}
            >
              Continue
            </button>
          </form>

          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #E8E5E0', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#8C8984', letterSpacing: '-0.01em' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: '#0F0F0F', fontWeight: 600, textDecoration: 'none', borderBottom: '1.5px solid #0F0F0F', paddingBottom: 1 }}>
                Sign in
              </Link>
            </p>
            <p style={{ marginTop: 14, fontSize: 11, color: '#C8C5BF', lineHeight: 1.6 }}>
              By continuing you agree to Tradeliv&apos;s{' '}
              <span style={{ color: '#8C8984', cursor: 'pointer' }}>Terms of Service</span>{' '}
              and <span style={{ color: '#8C8984', cursor: 'pointer' }}>Privacy Policy</span>.
            </p>
          </div>

        </div>
      </div>
    );
  }

  /* ══ Phase 2 ════════════════════════════════════════ */
  return (
    <div style={pageStyle}>
      <div className="anim-fade-up" style={{ width: '100%', maxWidth: 420 }}>

        <div style={{ marginBottom: 48 }}>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', color: '#0F0F0F' }}>Tradeliv</span>
        </div>

        <StepIndicator phase={phase} />

        <div style={{ marginBottom: 44 }}>
          <h1 style={{ fontSize: 40, fontWeight: 300, letterSpacing: '-0.05em', color: '#0F0F0F', lineHeight: 1.05, marginBottom: 14 }}>
            Your studio.
          </h1>
          <p style={{ fontSize: 14, color: '#8C8984', letterSpacing: '-0.01em' }}>
            Help us personalise your trade experience.{' '}
            <span style={{ color: '#B0ADA8' }}>All fields are optional.</span>
          </p>
        </div>

        <form onSubmit={handleP2} noValidate aria-label="Studio details - step 2">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label htmlFor="signup-business" style={LABEL}>Business Name</label>
              <input
                id="signup-business"
                type="text" placeholder="Chen Studio" value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                style={INPUT}
                onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
                onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
              />
            </div>
            <div>
              <label htmlFor="signup-phone" style={LABEL}>Phone Number</label>
              <input
                id="signup-phone"
                type="tel" placeholder="+1 555 000 0000" value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={INPUT}
                onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
                onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="signup-experience" style={LABEL}>Years of Experience</label>
            <div style={{ position: 'relative' }}>
              <select
                id="signup-experience"
                value={experience} onChange={(e) => setExperience(e.target.value)}
                aria-label="Years of experience"
                style={{
                  ...INPUT,
                  paddingRight: 40, appearance: 'none',
                  cursor: 'pointer', color: experience ? '#0F0F0F' : '#C8C5BF',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
                onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
              >
                <option value="" disabled>Select range</option>
                <option value="<2">Less than 2 years</option>
                <option value="2-5">2 – 5 years</option>
                <option value="5-10">5 – 10 years</option>
                <option value="10+">10+ years</option>
              </select>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B0ADA8" strokeWidth="2"
                style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={LABEL}>Specializations</label>
            <SpecSelect specs={specs} onToggle={toggleSpec} />
          </div>

          <div style={{ marginBottom: 32 }}>
            <label htmlFor="signup-portfolio" style={LABEL}>
              Portfolio URL{' '}
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#C8C5BF' }}>(optional)</span>
            </label>
            <input
              id="signup-portfolio"
              type="url" placeholder="https://yourportfolio.com" value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
              style={INPUT}
              onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
              onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
            />
          </div>

          {error && (
            <div role="alert" style={{
              background: 'rgba(185,28,28,0.04)', border: '1px solid rgba(185,28,28,0.12)',
              borderRadius: 8, padding: '10px 13px', fontSize: 13, color: '#b91c1c',
              marginBottom: 16, letterSpacing: '-0.01em',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => { setPhase(1); setError(''); }}
              aria-label="Go back to step 1"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '13px 20px', background: 'transparent',
                border: '1.5px solid #E4E1DC', borderRadius: 10,
                fontSize: 14, fontWeight: 500, color: '#6B6B6B',
                cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.01em',
                transition: 'border-color 0.14s, color 0.14s',
              }}
              onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = '#0F0F0F'; b.style.color = '#0F0F0F'; }}
              onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = '#E4E1DC'; b.style.color = '#6B6B6B'; }}
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '13px 0',
                background: '#0F0F0F', color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                opacity: loading ? 0.55 : 1,
                transition: 'background 0.14s, transform 0.12s, opacity 0.14s',
              }}
              onMouseEnter={(e) => { if (!loading) { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#1A1A1A'; b.style.transform = 'translateY(-1px)'; }}}
              onMouseLeave={(e) => { if (!loading) { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#0F0F0F'; b.style.transform = 'translateY(0)'; }}}
            >
              {loading
                ? <><svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg> Creating account…</>
                : 'Create account'
              }
            </button>
          </div>

          {/* Skip for now */}
          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            style={{
              display: 'block', width: '100%', marginTop: 12,
              padding: '10px 0', background: 'transparent', border: 'none',
              fontSize: 13, fontWeight: 500, color: '#B0ADA8',
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              letterSpacing: '-0.01em',
              transition: 'color 0.14s',
              textAlign: 'center',
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.color = '#6B6B6B'; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.color = '#B0ADA8'; }}
          >
            Skip for now — complete in Settings
          </button>
        </form>

      </div>
    </div>
  );
}
