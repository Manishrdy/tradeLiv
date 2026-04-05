'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

type State = 'loading' | 'success' | 'error' | 'expired';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [state,   setState]   = useState<State>('loading');
  const [message, setMessage] = useState('');

  const [resendEmail,    setResendEmail]    = useState('');
  const [resendLoading,  setResendLoading]  = useState(false);
  const [resendMsg,      setResendMsg]      = useState('');
  const [resendCooldown, setResendCooldown] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('No verification token found. Please use the link from your email.');
      return;
    }

    api.verifyEmail(token).then((r) => {
      if (r.data?.verified) {
        setState('success');
      } else {
        if ((r as { code?: string }).code === 'TOKEN_EXPIRED') {
          setState('expired');
        } else {
          setState('error');
        }
        setMessage(r.error ?? 'This link is invalid or has already been used.');
      }
    });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleResend() {
    if (!resendEmail.trim() || resendCooldown || resendLoading) return;
    setResendLoading(true);
    setResendMsg('');
    await api.resendVerification(resendEmail.trim());
    setResendLoading(false);
    setResendMsg('If that email is registered and unverified, a new link has been sent.');
    setResendCooldown(true);
    setTimeout(() => setResendCooldown(false), 60_000);
  }

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh', background: '#FAFAF8',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '48px 24px',
  };

  if (state === 'loading') {
    return (
      <div style={pageStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#B0ADA8', fontSize: 13.5 }}>
          <svg className="anim-rotate" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Verifying your email…
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div style={pageStyle}>
        <div className="anim-scale-in" style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#EDFAF3',
            margin: '0 auto 28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2d7a4f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-0.04em', color: '#0F0F0F', marginBottom: 10 }}>
            Email verified!
          </h2>
          <p style={{ fontSize: 14, color: '#8C8984', lineHeight: 1.6, marginBottom: 36 }}>
            Your application is now under review. We&apos;ll email you within 1–2 business days once it&apos;s been approved.
          </p>
          <Link
            href="/login"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 14, fontWeight: 600, color: '#fff',
              background: '#0F0F0F', borderRadius: 10,
              padding: '12px 28px', textDecoration: 'none',
              transition: 'background 0.14s',
            }}
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  // expired or error — show resend form
  return (
    <div style={pageStyle}>
      <div className="anim-scale-in" style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: state === 'expired' ? '#FDF5E6' : 'rgba(185,28,28,0.06)',
          margin: '0 auto 28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke={state === 'expired' ? '#7a5c2d' : '#b91c1c'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {state === 'expired'
              ? <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>
              : <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>
            }
          </svg>
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 300, letterSpacing: '-0.04em', color: '#0F0F0F', marginBottom: 10 }}>
          {state === 'expired' ? 'Link expired' : 'Link invalid'}
        </h2>
        <p style={{ fontSize: 14, color: '#8C8984', lineHeight: 1.6, marginBottom: 28 }}>
          {message}
        </p>

        <div style={{ textAlign: 'left', marginBottom: 28 }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: '#B0ADA8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
            Request a new link
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="email"
              placeholder="your@email.com"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleResend()}
              style={{
                flex: 1, background: '#fff', border: '1.5px solid #E4E1DC',
                borderRadius: 8, padding: '10px 12px', fontSize: 13.5,
                color: '#0F0F0F', fontFamily: 'inherit', outline: 'none',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
              onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
            />
            <button
              onClick={handleResend}
              disabled={resendLoading || resendCooldown || !resendEmail.trim()}
              style={{
                padding: '10px 16px', background: '#0F0F0F', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                cursor: (resendLoading || resendCooldown || !resendEmail.trim()) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', opacity: (resendLoading || !resendEmail.trim()) ? 0.55 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {resendLoading ? 'Sending…' : 'Send link'}
            </button>
          </div>
          {resendMsg && (
            <p style={{ fontSize: 12.5, color: '#22c55e', marginTop: 8 }}>{resendMsg}</p>
          )}
        </div>

        <Link
          href="/login"
          style={{ fontSize: 13, color: '#B0ADA8', textDecoration: 'none', borderBottom: '1px solid #E8E5E0', paddingBottom: 1 }}
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
