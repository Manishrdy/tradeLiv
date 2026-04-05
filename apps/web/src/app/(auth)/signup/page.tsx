'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Phase = 1 | 2 | 'success';

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
  'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky',
  'Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi',
  'Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico',
  'New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania',
  'Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
];

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function isValidPhone(v: string): boolean {
  return /^(\+1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/.test(v.trim());
}

const REFERRAL_OPTIONS = [
  { value: 'referral', label: 'Referral from a colleague' },
  { value: 'google_search', label: 'Google Search' },
  { value: 'ai_chatbots', label: 'AI Chatbots / Tools' },
  { value: 'event', label: 'Trade show or event' },
  { value: 'social_media', label: 'Social media' },
  { value: 'other', label: 'Other' },
];

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
        }}>02 <span style={{ fontWeight: 400, fontSize: 10, color: step >= 2 ? '#B0ADA8' : '#D4D1CC' }}>Business</span></span>
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

/* ── Chevron for dropdowns ─────────────────────────── */

function ChevronDown() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B0ADA8" strokeWidth="2"
      style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════ */

export default function SignupPage() {
  const [phase,         setPhase]         = useState<Phase>(1);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [showPw,        setShowPw]        = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg,     setResendMsg]     = useState('');
  const [resendCooldown, setResendCooldown] = useState(false);

  // Phase 1
  const [fullName,  setFullName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [touched1,  setTouched1]  = useState<Record<string, boolean>>({});

  // Phase 2
  const [businessName,     setBusinessName]     = useState('');
  const [phone,            setPhone]            = useState('');
  const [city,             setCity]             = useState('');
  const [state,            setState]            = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [websiteUrl,       setWebsiteUrl]       = useState('');
  const [linkedinUrl,      setLinkedinUrl]      = useState('');
  const [instagramUrl,     setInstagramUrl]     = useState('');
  const [referralSource,   setReferralSource]   = useState('');
  const [touched2,         setTouched2]         = useState<Record<string, boolean>>({});

  /* ── Inline validations (Phase 1) ─────────────────── */
  const nameErr    = touched1.fullName && (!fullName.trim() || fullName.trim().split(/\s+/).length < 2) ? 'Enter your first and last name.' : '';
  const emailErr   = touched1.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address.' : '';
  const pwErr      = touched1.password && password.length > 0 && password.length < 8 ? 'At least 8 characters required.' : '';
  const confirmErr = touched1.confirmPw && confirmPw && password !== confirmPw ? 'Passwords do not match.' : '';

  /* ── Inline validations (Phase 2) ─────────────────── */
  const bizErr  = touched2.businessName && !businessName.trim() ? 'Business name is required.' : '';
  const phoneErr = touched2.phone && !isValidPhone(phone) ? (!phone.trim() ? 'Phone number is required.' : 'Enter a valid US phone number, e.g. (555) 555-5555.') : '';
  const cityErr  = touched2.city && !city.trim() ? 'City is required.' : '';
  const stateErr = touched2.state && !state ? 'State is required.' : '';
  const expErr   = touched2.yearsOfExperience && !yearsOfExperience ? 'Select your experience level.' : '';

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
    if (!fullName.trim())                              return 'Full name is required.';
    if (fullName.trim().split(/\s+/).length < 2)       return 'Please enter your first and last name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))   return 'Valid email required.';
    if (password.length < 8)                            return 'Password must be at least 8 characters.';
    if (password !== confirmPw)                         return 'Passwords do not match.';
    return null;
  }

  function validateP2(): string | null {
    if (!businessName.trim())   return 'Business name is required.';
    if (!phone.trim())          return 'Phone number is required.';
    if (!isValidPhone(phone))   return 'Enter a valid US phone number, e.g. (555) 555-5555.';
    if (!city.trim())           return 'City is required.';
    if (!state)                 return 'State is required.';
    if (!yearsOfExperience)     return 'Years of experience is required.';
    return null;
  }

  async function handleResend() {
    if (resendCooldown || resendLoading) return;
    setResendLoading(true);
    setResendMsg('');
    await api.resendVerification(email);
    setResendLoading(false);
    setResendMsg('Verification email sent!');
    setResendCooldown(true);
    setTimeout(() => setResendCooldown(false), 60_000);
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
    setTouched2({ businessName: true, phone: true, city: true, state: true, yearsOfExperience: true });
    const err = validateP2();
    if (err) { setError(err); return; }

    setLoading(true);
    setError('');
    const result = await api.signupDesigner({
      fullName, email, password,
      businessName, phone, city, state, yearsOfExperience,
      websiteUrl: websiteUrl || undefined,
      linkedinUrl: linkedinUrl || undefined,
      instagramUrl: instagramUrl || undefined,
      referralSource: referralSource || undefined,
    });
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    setPhase('success');
  }

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

  /* ══ Success screen — Verify your email ═══════════ */
  if (phase === 'success') {
    return (
      <div style={pageStyle}>
        <div className="anim-scale-in" style={{ textAlign: 'center', padding: 24, maxWidth: 420 }}>
          {/* Envelope icon */}
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#F0F4FF',
            margin: '0 auto 28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b5bdb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>

          <h2 style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-0.04em', color: '#0F0F0F', marginBottom: 8 }}>
            Check your inbox
          </h2>
          <p style={{ fontSize: 14, color: '#8C8984', marginBottom: 28, letterSpacing: '-0.01em', lineHeight: 1.6 }}>
            We sent a verification link to <strong style={{ color: '#0F0F0F' }}>{email}</strong>. Click it to submit your application for review.
          </p>

          <div style={{
            background: '#fff', border: '1px solid #E8E5E0', borderRadius: 12,
            padding: '20px 24px', textAlign: 'left', marginBottom: 28,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b5bdb" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0F0F0F' }}>What happens next?</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li style={{ fontSize: 13, color: '#6B6B6B', lineHeight: 1.5 }}>
                Click the link in your email to verify your address.
              </li>
              <li style={{ fontSize: 13, color: '#6B6B6B', lineHeight: 1.5 }}>
                Once verified, our team will review your application (usually 1–2 business days).
              </li>
              <li style={{ fontSize: 13, color: '#6B6B6B', lineHeight: 1.5 }}>
                After approval, you&apos;ll receive a confirmation email and can sign in.
              </li>
            </ul>
          </div>

          <button
            onClick={handleResend}
            disabled={resendLoading || resendCooldown}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: resendCooldown ? '#B0ADA8' : '#0F0F0F',
              background: 'none', border: 'none', cursor: resendCooldown ? 'default' : 'pointer',
              fontFamily: 'inherit', padding: 0, marginBottom: 20,
              textDecoration: resendCooldown ? 'none' : 'underline',
            }}
          >
            {resendLoading
              ? 'Sending…'
              : resendCooldown
                ? 'Email sent — check your inbox'
                : 'Resend verification email'
            }
          </button>
          {resendMsg && !resendCooldown && (
            <p style={{ fontSize: 12, color: '#22c55e', marginBottom: 16 }}>{resendMsg}</p>
          )}

          <div>
            <Link
              href="/login"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600, color: '#0F0F0F',
                textDecoration: 'none', borderBottom: '1.5px solid #0F0F0F', paddingBottom: 1,
              }}
            >
              Back to sign in
            </Link>
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
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', color: '#0F0F0F' }}>tradeLiv</span>
          </div>

          <StepIndicator phase={phase} />

          <div style={{ marginBottom: 44 }}>
            <h1 style={{ fontSize: 40, fontWeight: 300, letterSpacing: '-0.05em', color: '#0F0F0F', lineHeight: 1.05, marginBottom: 14 }}>
              Create your account.
            </h1>
            <p style={{ fontSize: 14, color: '#8C8984', letterSpacing: '-0.01em' }}>
              Join trade professionals on tradeLiv.
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
              By continuing you agree to tradeLiv&apos;s{' '}
              <span style={{ color: '#8C8984', cursor: 'pointer' }}>Terms of Service</span>{' '}
              and <span style={{ color: '#8C8984', cursor: 'pointer' }}>Privacy Policy</span>.
            </p>
          </div>

        </div>
      </div>
    );
  }

  /* ══ Phase 2 — Business Details ════════════════════ */
  return (
    <div style={pageStyle}>
      <div className="anim-fade-up" style={{ width: '100%', maxWidth: 460 }}>

        <div style={{ marginBottom: 48 }}>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', color: '#0F0F0F' }}>tradeLiv</span>
        </div>

        <StepIndicator phase={phase} />

        <div style={{ marginBottom: 44 }}>
          <h1 style={{ fontSize: 40, fontWeight: 300, letterSpacing: '-0.05em', color: '#0F0F0F', lineHeight: 1.05, marginBottom: 14 }}>
            Your business.
          </h1>
          <p style={{ fontSize: 14, color: '#8C8984', letterSpacing: '-0.01em', lineHeight: 1.5 }}>
            Help us verify your practice. Fields marked with <span style={{ color: '#ef4444' }}>*</span> are required.
          </p>
        </div>

        <form onSubmit={handleP2} noValidate aria-label="Business details - step 2">

          {/* Business Name */}
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="signup-business" style={LABEL}>Business Name <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              id="signup-business"
              type="text" placeholder="Chen Design Studio" value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              onBlur={() => setTouched2((t) => ({ ...t, businessName: true }))}
              aria-required="true"
              aria-invalid={!!bizErr}
              style={{ ...INPUT, borderColor: bizErr ? '#ef4444' : undefined }}
              onFocus={(e) => (e.target.style.borderColor = bizErr ? '#ef4444' : '#0F0F0F')}
            />
            {bizErr && <p role="alert" style={FIELD_ERROR}>{bizErr}</p>}
          </div>

          {/* Phone */}
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="signup-phone" style={LABEL}>Phone Number <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              id="signup-phone"
              type="tel" placeholder="(555) 000-0000" value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              onBlur={() => setTouched2((t) => ({ ...t, phone: true }))}
              aria-required="true"
              aria-invalid={!!phoneErr}
              style={{ ...INPUT, borderColor: phoneErr ? '#ef4444' : undefined }}
              onFocus={(e) => (e.target.style.borderColor = phoneErr ? '#ef4444' : '#0F0F0F')}
            />
            {phoneErr && <p role="alert" style={FIELD_ERROR}>{phoneErr}</p>}
          </div>

          {/* City + State */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label htmlFor="signup-city" style={LABEL}>City <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                id="signup-city"
                type="text" placeholder="San Francisco" value={city}
                onChange={(e) => setCity(e.target.value)}
                onBlur={() => setTouched2((t) => ({ ...t, city: true }))}
                aria-required="true"
                aria-invalid={!!cityErr}
                style={{ ...INPUT, borderColor: cityErr ? '#ef4444' : undefined }}
                onFocus={(e) => (e.target.style.borderColor = cityErr ? '#ef4444' : '#0F0F0F')}
              />
              {cityErr && <p role="alert" style={FIELD_ERROR}>{cityErr}</p>}
            </div>
            <div>
              <label htmlFor="signup-state" style={LABEL}>State <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <select
                  id="signup-state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  onBlur={() => setTouched2((t) => ({ ...t, state: true }))}
                  aria-required="true"
                  aria-invalid={!!stateErr}
                  style={{
                    ...INPUT, paddingRight: 40, appearance: 'none', cursor: 'pointer',
                    color: state ? '#0F0F0F' : '#C8C5BF',
                    borderColor: stateErr ? '#ef4444' : undefined,
                  }}
                  onFocus={(e) => (e.target.style.borderColor = stateErr ? '#ef4444' : '#0F0F0F')}
                >
                  <option value="" disabled>Select state</option>
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown />
              </div>
              {stateErr && <p role="alert" style={FIELD_ERROR}>{stateErr}</p>}
            </div>
          </div>

          {/* Years of Experience */}
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="signup-experience" style={LABEL}>Years of Experience <span style={{ color: '#ef4444' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <select
                id="signup-experience"
                value={yearsOfExperience}
                onChange={(e) => setYearsOfExperience(e.target.value)}
                onBlur={() => setTouched2((t) => ({ ...t, yearsOfExperience: true }))}
                aria-required="true"
                aria-invalid={!!expErr}
                style={{
                  ...INPUT, paddingRight: 40, appearance: 'none', cursor: 'pointer',
                  color: yearsOfExperience ? '#0F0F0F' : '#C8C5BF',
                  borderColor: expErr ? '#ef4444' : undefined,
                }}
                onFocus={(e) => (e.target.style.borderColor = expErr ? '#ef4444' : '#0F0F0F')}
              >
                <option value="" disabled>Select range</option>
                <option value="<2">Less than 2 years</option>
                <option value="2-5">2 – 5 years</option>
                <option value="5-10">5 – 10 years</option>
                <option value="10+">10+ years</option>
              </select>
              <ChevronDown />
            </div>
            {expErr && <p role="alert" style={FIELD_ERROR}>{expErr}</p>}
          </div>

          {/* Divider — optional fields */}
          <div style={{ height: 1, background: '#E8E5E0', margin: '24px 0 20px' }} />
          <p style={{ fontSize: 11, fontWeight: 600, color: '#B0ADA8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>
            Optional
          </p>

          {/* Website / Portfolio */}
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="signup-website" style={LABEL}>Website / Portfolio</label>
            <input
              id="signup-website"
              type="url" placeholder="https://yourstudio.com" value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              style={INPUT}
              onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
              onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
            />
          </div>

          {/* LinkedIn + Instagram */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label htmlFor="signup-linkedin" style={LABEL}>LinkedIn Profile</label>
              <input
                id="signup-linkedin"
                type="url" placeholder="https://linkedin.com/in/..." value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                style={INPUT}
                onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
                onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
              />
            </div>
            <div>
              <label htmlFor="signup-instagram" style={LABEL}>Instagram</label>
              <input
                id="signup-instagram"
                type="text" placeholder="@yourstudio" value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                style={INPUT}
                onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
                onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
              />
            </div>
          </div>

          {/* How did you hear about us */}
          <div style={{ marginBottom: 32 }}>
            <label htmlFor="signup-referral" style={LABEL}>How did you hear about us?</label>
            <div style={{ position: 'relative' }}>
              <select
                id="signup-referral"
                value={referralSource}
                onChange={(e) => setReferralSource(e.target.value)}
                style={{
                  ...INPUT, paddingRight: 40, appearance: 'none', cursor: 'pointer',
                  color: referralSource ? '#0F0F0F' : '#C8C5BF',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
                onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
              >
                <option value="" disabled>Select an option</option>
                {REFERRAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown />
            </div>
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
              &larr; Back
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
                ? <><svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg> Submitting…</>
                : 'Submit application'
              }
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
