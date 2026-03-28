'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

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

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await api.adminLogin({ email: email.trim(), password, remember });
    setLoading(false);
    if (result.error || !result.data) {
      setError(result.error ?? 'Login failed');
      return;
    }
    router.push('/admin/dashboard');
  }

  const emailError = touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address.' : '';
  const passwordError = touched.password && !password ? 'Password is required.' : '';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAFAF8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ marginBottom: 40 }}>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', color: '#0F0F0F' }}>
            tradeLiv
          </span>
          <span
            style={{
              marginLeft: 10,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#8C8984',
            }}
          >
            Admin
          </span>
        </div>

        <h1
          style={{
            fontSize: 36,
            fontWeight: 300,
            letterSpacing: '-0.05em',
            color: '#0F0F0F',
            lineHeight: 1.06,
            marginBottom: 12,
          }}
        >
          Admin sign in
        </h1>
        <p style={{ fontSize: 14, color: '#8C8984', letterSpacing: '-0.01em', lineHeight: 1.5, marginBottom: 36 }}>
          Use the admin portal for internal operations.
        </p>

        <form onSubmit={handleSubmit} noValidate aria-label="Admin sign in">
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="admin-login-email" style={LABEL}>
              Email address
            </label>
            <input
              id="admin-login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              style={{ ...INPUT, borderColor: emailError ? '#ef4444' : undefined }}
              aria-invalid={!!emailError}
            />
            {emailError && (
              <p role="alert" style={{ fontSize: 12, color: '#ef4444', marginTop: 5 }}>
                {emailError}
              </p>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="admin-login-password" style={LABEL}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="admin-login-password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                style={{ ...INPUT, paddingRight: 44, borderColor: passwordError ? '#ef4444' : undefined }}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: 13,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#C8C5BF',
                  padding: 0,
                }}
              >
                <EyeIcon open={showPw} />
              </button>
            </div>
            {passwordError && (
              <p role="alert" style={{ fontSize: 12, color: '#ef4444', marginTop: 5 }}>
                {passwordError}
              </p>
            )}
          </div>

          <label
            htmlFor="admin-login-remember"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 20,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              id="admin-login-remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span style={{ fontSize: 13, color: '#8C8984' }}>Remember me</span>
          </label>

          {error && (
            <div
              role="alert"
              style={{
                background: 'rgba(185,28,28,0.04)',
                border: '1px solid rgba(185,28,28,0.12)',
                borderRadius: 8,
                padding: '10px 13px',
                fontSize: 13,
                color: '#b91c1c',
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px 0',
              background: '#0F0F0F',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.55 : 1,
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <Link href="/login" style={{ fontSize: 13, color: '#6B6B6B', textDecoration: 'none' }}>
            Designer sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
