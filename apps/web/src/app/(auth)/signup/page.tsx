'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

type Phase = 1 | 2;

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

function StepIndicator({ phase }: { phase: Phase }) {
  const step = phase as number;
  return (
    <div style={{ marginBottom: 44 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: step >= 1 ? '#0F0F0F' : '#C8C5BF',
          transition: 'color 0.3s',
        }}>01</span>
        <span style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: step >= 2 ? '#0F0F0F' : '#C8C5BF',
          transition: 'color 0.3s',
        }}>02</span>
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

  // Phase 2
  const [businessName, setBusinessName] = useState('');
  const [phone,        setPhone]        = useState('');
  const [experience,   setExperience]   = useState('');
  const [specs,        setSpecs]        = useState<string[]>([]);
  const [portfolio,    setPortfolio]    = useState('');

  function toggleSpec(val: string) {
    setSpecs((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]);
  }

  function validateP1(): string | null {
    if (!fullName.trim())                                    return 'Full name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))         return 'Valid email required.';
    if (password.length < 8)                                 return 'Password must be at least 8 characters.';
    if (password !== confirmPw)                              return 'Passwords do not match.';
    return null;
  }

  function handleP1(e: React.FormEvent) {
    e.preventDefault();
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
    router.push('/dashboard');
  }

  const pwStrength = Math.min(4, Math.floor(password.length / 3));
  const strengthColor = ['#ef4444', '#f97316', '#eab308', '#22c55e'][pwStrength - 1] ?? 'transparent';

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

  /* ── Phase 1 ─────────────────────────────────────── */
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

          <form onSubmit={handleP1} noValidate>
            <div style={{ marginBottom: 16 }}>
              <label style={LABEL}>Full Name</label>
              <input
                type="text" placeholder="Alexandra Chen" value={fullName}
                onChange={(e) => setFullName(e.target.value)} autoComplete="name" autoFocus
                style={INPUT}
                onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
                onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={LABEL}>Email Address</label>
              <input
                type="email" placeholder="alex@yourstudio.com" value={email}
                onChange={(e) => setEmail(e.target.value)} autoComplete="email"
                style={INPUT}
                onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
                onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={LABEL}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'} placeholder="Min. 8 characters" value={password}
                  onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
                  style={{ ...INPUT, paddingRight: 44 }}
                  onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
                  onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPw((v) => !v)}
                  style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#C8C5BF', display: 'flex', alignItems: 'center', padding: 0 }}>
                  <EyeIcon open={showPw} />
                </button>
              </div>
              {password.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} style={{
                      flex: 1, height: 2.5, borderRadius: 999,
                      background: n <= pwStrength ? strengthColor : '#E4E1DC',
                      transition: 'background 0.25s',
                    }} />
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 32 }}>
              <label style={LABEL}>Confirm Password</label>
              <input
                type={showPw ? 'text' : 'password'} placeholder="Re-enter password" value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password"
                style={INPUT}
                onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
                onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
              />
            </div>

            {error && (
              <div style={{
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

  /* ── Phase 2 ─────────────────────────────────────── */
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
            Help us personalise your trade experience.
          </p>
        </div>

        <form onSubmit={handleP2} noValidate>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={LABEL}>Business Name</label>
              <input
                type="text" placeholder="Chen Studio" value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                style={INPUT}
                onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
                onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
              />
            </div>
            <div>
              <label style={LABEL}>Phone Number</label>
              <input
                type="tel" placeholder="+1 555 000 0000" value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={INPUT}
                onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
                onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={LABEL}>Years of Experience</label>
            <div style={{ position: 'relative' }}>
              <select
                value={experience} onChange={(e) => setExperience(e.target.value)}
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {DESIGNER_SPECS.map((s) => {
                const active = specs.includes(s);
                return (
                  <button
                    key={s} type="button" onClick={() => toggleSpec(s)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '5px 13px',
                      background: active ? '#0F0F0F' : '#fff',
                      border: `1.5px solid ${active ? '#0F0F0F' : '#E4E1DC'}`,
                      borderRadius: 999, fontSize: 12.5, fontWeight: active ? 600 : 400,
                      color: active ? '#fff' : '#6B6B6B',
                      cursor: 'pointer', fontFamily: 'inherit',
                      letterSpacing: '-0.01em',
                      transition: 'background 0.14s, border-color 0.14s, color 0.14s',
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={LABEL}>
              Portfolio URL{' '}
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#C8C5BF' }}>(optional)</span>
            </label>
            <input
              type="url" placeholder="https://yourportfolio.com" value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
              style={INPUT}
              onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
              onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
            />
          </div>

          {error && (
            <div style={{
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
        </form>

      </div>
    </div>
  );
}
