'use client';

import { useState } from 'react';
import { api, FeeDefaults } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth';

interface Props {
  firstName: string;
  onComplete: () => void;
}

const INPUT: React.CSSProperties = {
  display: 'block',
  width: '100%',
  background: '#F7F6F3',
  border: '1.5px solid #E4E1DC',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13.5,
  color: '#0F0F0F',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.14s',
  boxSizing: 'border-box',
};

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: '#B0ADA8',
  marginBottom: 6,
};

export default function OnboardingWizard({ firstName, onComplete }: Props) {
  const setUser = useAuthStore((s) => s.setUser);
  const user    = useAuthStore((s) => s.user);

  const [step,    setStep]    = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Fee defaults form state
  const [taxRate,          setTaxRate]          = useState('');
  const [commissionType,   setCommissionType]   = useState<'percentage' | 'fixed'>('percentage');
  const [commissionValue,  setCommissionValue]  = useState('');
  const [platformFeeType,  setPlatformFeeType]  = useState<'percentage' | 'fixed'>('percentage');
  const [platformFeeValue, setPlatformFeeValue] = useState('');

  async function handleFinish(skip = false) {
    setLoading(true);
    setError('');

    if (!skip) {
      const payload: FeeDefaults = {};
      if (taxRate)         payload.taxRate          = parseFloat(taxRate);
      if (commissionValue) payload.commissionValue  = parseFloat(commissionValue);
      if (commissionValue) payload.commissionType   = commissionType;
      if (platformFeeValue) payload.platformFeeValue = parseFloat(platformFeeValue);
      if (platformFeeValue) payload.platformFeeType  = platformFeeType;

      if (Object.keys(payload).length > 0) {
        const r = await api.updateFeeDefaults(payload);
        if (r.error) { setError(r.error); setLoading(false); return; }
      }
    }

    await api.completeOnboarding();
    if (user) setUser({ ...user, onboardingComplete: true });
    setLoading(false);
    onComplete();
  }

  return (
    /* Overlay */
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div className="anim-scale-in" style={{
        background: '#FAFAF8', borderRadius: 16,
        width: '100%', maxWidth: 460,
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        overflow: 'hidden',
      }}>

        {/* Step 1 — Welcome */}
        {step === 1 && (
          <div style={{ padding: '44px 40px 40px' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: '#0F0F0F', display: 'flex', alignItems: 'center',
              justifyContent: 'center', marginBottom: 28,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-0.04em', color: '#0F0F0F', marginBottom: 12 }}>
              Welcome, {firstName}.
            </h2>
            <p style={{ fontSize: 14, color: '#6B6B6B', lineHeight: 1.6, marginBottom: 8 }}>
              Your account is approved. Before you dive in, let&apos;s take 60 seconds to set up your default fees — they&apos;ll be pre-filled every time you create a quote.
            </p>
            <p style={{ fontSize: 13, color: '#B0ADA8', lineHeight: 1.6, marginBottom: 36 }}>
              You can always update these later in Settings.
            </p>
            <button
              onClick={() => setStep(2)}
              style={{
                width: '100%', padding: '13px 0',
                background: '#0F0F0F', color: '#fff',
                border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.14s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#1A1A1A')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#0F0F0F')}
            >
              Set up fee defaults
            </button>
            <button
              onClick={() => handleFinish(true)}
              disabled={loading}
              style={{
                display: 'block', width: '100%', marginTop: 12, padding: '10px 0',
                background: 'none', border: 'none', borderRadius: 10,
                fontSize: 13, color: '#B0ADA8', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Step 2 — Fee defaults */}
        {step === 2 && (
          <div style={{ padding: '40px 40px 36px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
              <button
                onClick={() => setStep(1)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B0ADA8', padding: 0, display: 'flex' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', color: '#0F0F0F', margin: 0 }}>
                Default fees
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              {/* Tax Rate */}
              <div>
                <label style={LABEL}>Tax rate (%)</label>
                <input
                  type="number" min="0" max="100" step="0.01"
                  placeholder="e.g. 8.25"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  style={INPUT}
                  onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
                  onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
                />
              </div>

              {/* Commission */}
              <div>
                <label style={LABEL}>Commission</label>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8 }}>
                  <select
                    value={commissionType}
                    onChange={(e) => setCommissionType(e.target.value as 'percentage' | 'fixed')}
                    style={{ ...INPUT, appearance: 'none', cursor: 'pointer' }}
                    onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
                    onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed ($)</option>
                  </select>
                  <input
                    type="number" min="0" step="0.01"
                    placeholder={commissionType === 'percentage' ? 'e.g. 15' : 'e.g. 500'}
                    value={commissionValue}
                    onChange={(e) => setCommissionValue(e.target.value)}
                    style={INPUT}
                    onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
                    onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
                  />
                </div>
              </div>

              {/* Platform fee */}
              <div>
                <label style={LABEL}>Platform fee</label>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8 }}>
                  <select
                    value={platformFeeType}
                    onChange={(e) => setPlatformFeeType(e.target.value as 'percentage' | 'fixed')}
                    style={{ ...INPUT, appearance: 'none', cursor: 'pointer' }}
                    onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
                    onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed ($)</option>
                  </select>
                  <input
                    type="number" min="0" step="0.01"
                    placeholder={platformFeeType === 'percentage' ? 'e.g. 5' : 'e.g. 250'}
                    value={platformFeeValue}
                    onChange={(e) => setPlatformFeeValue(e.target.value)}
                    style={INPUT}
                    onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
                    onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div role="alert" style={{
                background: 'rgba(185,28,28,0.04)', border: '1px solid rgba(185,28,28,0.12)',
                borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#b91c1c',
                marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <button
              onClick={() => handleFinish(false)}
              disabled={loading}
              style={{
                width: '100%', padding: '13px 0',
                background: '#0F0F0F', color: '#fff',
                border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: loading ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading
                ? <><svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg> Saving…</>
                : 'Save & finish'
              }
            </button>
            <button
              onClick={() => handleFinish(true)}
              disabled={loading}
              style={{
                display: 'block', width: '100%', marginTop: 10, padding: '10px 0',
                background: 'none', border: 'none', borderRadius: 10,
                fontSize: 13, color: '#B0ADA8', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
