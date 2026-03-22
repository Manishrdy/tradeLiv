'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth';

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

export default function LoginPage() {
  const router  = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [remember,   setRemember]   = useState(false);
  const [touched,    setTouched]    = useState<{ email?: boolean; password?: boolean }>({});

  useEffect(() => {
    if (!success) return;
    let p = 0;
    const iv = setInterval(() => {
      p += 2.2;
      setProgress(Math.min(p, 100));
      if (p >= 100) { clearInterval(iv); router.push('/dashboard'); }
    }, 40);
    return () => clearInterval(iv);
  }, [success, router]);

  const emailError = touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address.' : '';
  const passwordError = touched.password && !password ? 'Password is required.' : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!email.trim() || !password) { setError('Please fill in all fields.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address.'); return; }
    setLoading(true);
    setError('');
    const result = await api.login({ email: email.trim(), password, remember });
    setLoading(false);
    if (result.error || !result.data) { setError(result.error ?? 'Login failed'); return; }
    if (result.data.role === 'admin') {
      router.push('/admin/dashboard');
      return;
    }
    setUser(result.data.user);
    setSuccess(true);
  }

  /* ── Success ─────────────────────────────────────── */
  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="anim-scale-in" style={{ textAlign: 'center', padding: 24, maxWidth: 300 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', background: '#0F0F0F',
            margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M8 16.5L13 21.5L24 10.5" stroke="#fff" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="50"
                style={{ animation: 'checkStroke 0.6s ease-out 0.1s both' }}
              />
            </svg>
          </div>
          <h3 style={{ fontSize: 24, fontWeight: 300, letterSpacing: '-0.04em', color: '#0F0F0F', marginBottom: 8 }}>
            Welcome back.
          </h3>
          <p style={{ fontSize: 13, color: '#B0ADA8', marginBottom: 36, letterSpacing: '-0.01em' }}>
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

  /* ── Login form ──────────────────────────────────── */
  return (
    <div style={{
      minHeight: '100vh',
      background: '#FAFAF8',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
    }}>
      <div className="anim-fade-up" style={{ width: '100%', maxWidth: 380 }}>

        {/* Wordmark */}
        <div style={{ marginBottom: 56 }}>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', color: '#0F0F0F' }}>
            Tradeliv
          </span>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: 48 }}>
          <h1 style={{
            fontSize: 44, fontWeight: 300, letterSpacing: '-0.05em',
            color: '#0F0F0F', lineHeight: 1.04, marginBottom: 14,
          }}>
            Welcome back.
          </h1>
          <p style={{ fontSize: 14, color: '#8C8984', letterSpacing: '-0.01em', lineHeight: 1.5 }}>
            Sign in to continue to your studio.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate aria-label="Sign in to your account">
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="login-email" style={LABEL}>Email address</label>
            <input
              id="login-email"
              type="email"
              placeholder="you@studio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              autoComplete="email"
              autoFocus
              aria-required="true"
              aria-invalid={!!emailError}
              aria-describedby={emailError ? 'login-email-error' : undefined}
              style={{ ...INPUT, borderColor: emailError ? '#ef4444' : undefined }}
              onFocus={(e) => (e.target.style.borderColor = emailError ? '#ef4444' : '#0F0F0F')}
            />
            {emailError && (
              <p id="login-email-error" role="alert" style={{ fontSize: 12, color: '#ef4444', marginTop: 5, letterSpacing: '-0.01em' }}>
                {emailError}
              </p>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="login-password" style={LABEL}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                autoComplete="current-password"
                aria-required="true"
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? 'login-password-error' : undefined}
                style={{ ...INPUT, paddingRight: 44, borderColor: passwordError ? '#ef4444' : undefined }}
                onFocus={(e) => (e.target.style.borderColor = passwordError ? '#ef4444' : '#0F0F0F')}
              />
              <button
                type="button" tabIndex={-1}
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: 13, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#C8C5BF', display: 'flex', alignItems: 'center', padding: 0,
                }}
              >
                <EyeIcon open={showPw} />
              </button>
            </div>
            {passwordError && (
              <p id="login-password-error" role="alert" style={{ fontSize: 12, color: '#ef4444', marginTop: 5, letterSpacing: '-0.01em' }}>
                {passwordError}
              </p>
            )}
          </div>

          {/* Remember Me */}
          <label
            htmlFor="login-remember"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 20, cursor: 'pointer', userSelect: 'none',
            }}
          >
            <div style={{
              width: 16, height: 16, borderRadius: 4,
              border: `1.5px solid ${remember ? '#0F0F0F' : '#D4D1CC'}`,
              background: remember ? '#0F0F0F' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.14s, border-color 0.14s',
              flexShrink: 0,
            }}>
              {remember && (
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5L6.5 12L13 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <input
              id="login-remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
            <span style={{ fontSize: 13, color: '#8C8984', letterSpacing: '-0.01em' }}>
              Remember me
            </span>
          </label>

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
            disabled={loading}
            aria-busy={loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '13px 0',
              background: '#0F0F0F', color: '#fff',
              border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: loading ? 0.55 : 1,
              transition: 'opacity 0.14s, transform 0.12s, background 0.14s',
            }}
            onMouseEnter={(e) => { if (!loading) { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#1A1A1A'; b.style.transform = 'translateY(-1px)'; }}}
            onMouseLeave={(e) => { if (!loading) { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#0F0F0F'; b.style.transform = 'translateY(0)'; }}}
          >
            {loading
              ? <><svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg> Signing in…</>
              : 'Sign in'
            }
          </button>
        </form>

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 28, borderTop: '1px solid #E8E5E0' }}>
          <Link
            href="/signup"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '100%', padding: '12px 0',
              border: '1.5px solid #E4E1DC', borderRadius: 10,
              textDecoration: 'none',
              fontSize: 14, fontWeight: 500, color: '#6B6B6B',
              letterSpacing: '-0.01em', fontFamily: 'inherit',
              transition: 'border-color 0.14s, color 0.14s',
            }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = '#0F0F0F'; el.style.color = '#0F0F0F'; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = '#E4E1DC'; el.style.color = '#6B6B6B'; }}
          >
            Create an account
          </Link>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#C8C5BF', letterSpacing: '-0.005em', lineHeight: 1.6 }}>
          By signing in, you agree to our{' '}
          <span style={{ color: '#8C8984', cursor: 'pointer' }}>Terms</span>
          {' '}and{' '}
          <span style={{ color: '#8C8984', cursor: 'pointer' }}>Privacy Policy</span>.
        </p>

      </div>
    </div>
  );
}
