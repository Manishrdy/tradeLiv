'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ImpersonatePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('No impersonation token provided.');
      setStatus('error');
      return;
    }

    // Exchange the admin-issued impersonation token for a tab-local Bearer token.
    // We deliberately do NOT use credentials:include here — impersonation sessions
    // must be isolated to this tab via sessionStorage, never via a shared cookie.
    fetch(`${API_URL}/api/auth/impersonate-session`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          setError(body.error || 'Failed to start session.');
          setStatus('error');
          return;
        }
        // Store the access token in sessionStorage (tab-local — never touches the admin's cookie)
        sessionStorage.setItem('impersonation_token', body.accessToken);
        sessionStorage.setItem('impersonation_user', JSON.stringify(body.user));
        // Redirect directly so the designer app loads fresh
        router.replace('/dashboard');
      })
      .catch(() => {
        setError('Unable to connect. Please try again.');
        setStatus('error');
      });
  }, [searchParams, router]);

  if (status === 'error') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#FAFAF8', padding: 24,
      }}>
        <div style={{
          background: '#fff', borderRadius: 14, padding: '36px 32px', maxWidth: 420, width: '100%',
          boxShadow: '0 4px 24px rgba(0,0,0,0.07)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F0F0F', margin: '0 0 8px', letterSpacing: '-0.03em' }}>
            Impersonation failed
          </h2>
          <p style={{ fontSize: 13.5, color: '#8C8984', margin: '0 0 24px', lineHeight: 1.5 }}>
            {error}
          </p>
          <button
            onClick={() => window.close()}
            style={{
              border: '1px solid #E4E1DC', borderRadius: 8, background: 'transparent',
              color: '#6B6B6B', padding: '9px 20px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Close tab
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#FAFAF8',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#8C8984', fontSize: 13.5 }}>
        <svg style={{ animation: 'spin 1s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
        Starting designer session…
      </div>
    </div>
  );
}
