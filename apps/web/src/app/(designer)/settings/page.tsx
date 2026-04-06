'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, DesignerProfile } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth';

/* ── Constants ─────────────────────────────────────── */

const DESIGNER_SPECS = ['Residential', 'Commercial', 'Hospitality', 'Retail', 'Healthcare', 'Luxury Villas', 'Offices', 'Show Homes'];

/* ── Toast component ───────────────────────────────── */

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="anim-fade-up"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 200,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 18px', borderRadius: 10,
        background: type === 'success' ? '#111' : '#b91c1c',
        color: '#fff', fontSize: 13, fontWeight: 600,
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        letterSpacing: '-0.01em',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        {type === 'success'
          ? <polyline points="20 6 9 17 4 12" />
          : <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>
        }
      </svg>
      {message}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '0 2px', marginLeft: 4 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

/* ── Delete account modal ──────────────────────────── */

function DeleteAccountModal({ onConfirm, onCancel, loading }: { onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  const [typed, setTyped] = useState('');
  const confirmed = typed === 'DELETE';

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onCancel}
    >
      <div className="anim-scale-in" onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, padding: '28px', width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(185,28,28,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6M9 6V4h6v2" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F0F0F', letterSpacing: '-0.02em', margin: 0 }}>Delete account?</h3>
            <p style={{ fontSize: 13, color: '#8C8984', margin: '4px 0 0' }}>This action is permanent and cannot be undone.</p>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            Type <strong>DELETE</strong> to confirm
          </label>
          <input
            className="input-field"
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="DELETE"
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
          <button
            onClick={onConfirm}
            disabled={!confirmed || loading}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
              background: confirmed ? '#b91c1c' : '#e5e5e5',
              color: confirmed ? '#fff' : '#999',
              fontSize: 13.5, fontWeight: 600, cursor: confirmed ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', transition: 'background 0.14s',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Settings Page
   ══════════════════════════════════════════════════════ */

export default function SettingsPage() {
  const router = useRouter();
  const { clearAuth } = useAuthStore();
  const [profile, setProfile]   = useState<DesignerProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [fullName, setFullName]         = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone]               = useState('');

  // Password change
  const [currentPw, setCurrentPw]         = useState('');
  const [newPw, setNewPw]                 = useState('');
  const [confirmPw, setConfirmPw]         = useState('');
  const [pwSaving, setPwSaving]           = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw]         = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [currentPwTouched, setCurrentPwTouched] = useState(false);

  // OTP modal
  const [showOtpModal, setShowOtpModal]   = useState(false);
  const [otpDigits, setOtpDigits]         = useState(['', '', '', '', '', '']);
  const [otpVerifying, setOtpVerifying]   = useState(false);
  const [otpError, setOtpError]           = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Specializations
  const [specs, setSpecs] = useState<string[]>([]);

  // Delete account
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  useEffect(() => {
    api.getMe().then((r) => {
      if (r.data) {
        setProfile(r.data);
        setFullName(r.data.fullName ?? '');
        setBusinessName(r.data.businessName ?? '');
        setPhone(r.data.phone ?? '');
      }
      setLoading(false);
    });
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { setToast({ message: 'Full name is required.', type: 'error' }); return; }
    setSaving(true);
    const r = await api.updateProfile({
      fullName: fullName.trim(),
      businessName: businessName.trim() || null,
      phone: phone.trim() || null,
    });
    setSaving(false);
    if (r.error) { setToast({ message: r.error, type: 'error' }); return; }
    if (r.data) setProfile(r.data);
    setToast({ message: 'Profile saved successfully.', type: 'success' });
  }

  const pwChecks = {
    length:    newPw.length >= 8,
    uppercase: /[A-Z]/.test(newPw),
    number:    /[0-9]/.test(newPw),
    special:   /[^A-Za-z0-9]/.test(newPw),
  };
  const pwValid = Object.values(pwChecks).every(Boolean);
  const confirmMatch = confirmPw.length > 0 && confirmPw === newPw;
  const confirmMismatch = confirmPw.length > 0 && confirmPw !== newPw;

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPw || !newPw || !confirmPw) { setToast({ message: 'Fill in all password fields.', type: 'error' }); return; }
    if (!pwValid) { setToast({ message: 'New password does not meet requirements.', type: 'error' }); return; }
    if (newPw !== confirmPw) { setToast({ message: 'Passwords do not match.', type: 'error' }); return; }
    setPwSaving(true);
    const r = await api.requestPasswordChangeOtp({ currentPassword: currentPw, newPassword: newPw });
    setPwSaving(false);
    if (r.error) { setToast({ message: r.error, type: 'error' }); return; }
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError('');
    setShowOtpModal(true);
    startResendCooldown();
  }

  function startResendCooldown() {
    setResendCooldown(60);
  }

  async function handleVerifyOtp() {
    const otp = otpDigits.join('');
    if (otp.length < 6) return;
    setOtpVerifying(true);
    setOtpError('');
    const r = await api.confirmPasswordChange({ otp });
    setOtpVerifying(false);
    if (r.error) { setOtpError(r.error); return; }
    setShowOtpModal(false);
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setShowCurrentPw(false); setShowNewPw(false); setShowConfirmPw(false);
    setCurrentPwTouched(false);
    setToast({ message: 'Password updated successfully.', type: 'success' });
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return;
    const r = await api.requestPasswordChangeOtp({ currentPassword: currentPw, newPassword: newPw });
    if (r.error) { setOtpError(r.error); return; }
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError('');
    startResendCooldown();
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    await api.logout();
    clearAuth();
    setDeleting(false);
    router.replace('/login');
  }

  function toggleSpec(val: string) {
    setSpecs((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]);
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 40px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13.5 }}>
        <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
        Loading…
      </div>
    );
  }

  const LABEL: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '-0.01em', display: 'block', marginBottom: 6 };

  return (
    <div style={{ padding: '40px 40px 60px', maxWidth: 640 }}>

      {/* ── Header ──────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.035em', margin: 0 }}>
          Settings
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
          Manage your account and profile information.
        </p>
      </div>

      {/* ── Profile section ────────────────────────── */}
      <div className="card" style={{ padding: '28px 28px 24px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '0 0 20px' }}>
          Profile
        </h2>

        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={LABEL}>Full name <span style={{ color: '#c0392b' }}>*</span></label>
            <input className="input-field" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith" required />
          </div>

          <div>
            <label style={LABEL}>Email</label>
            <input className="input-field" type="email" value={profile?.email ?? ''} readOnly style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Email cannot be changed. Contact support if needed.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={LABEL}>Business name</label>
              <input className="input-field" type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Smith Interiors" />
            </div>
            <div>
              <label style={LABEL}>Phone</label>
              <input className="input-field" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="submit" className="btn-primary" disabled={saving} style={{ minWidth: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              {saving && <svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Specializations section ────────────────── */}
      <div className="card" style={{ padding: '28px 28px 24px', marginTop: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>
          Specializations
        </h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 16px' }}>
          Select your areas of expertise. These help personalize your experience.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {DESIGNER_SPECS.map((s) => {
            const active = specs.includes(s);
            return (
              <button
                key={s} type="button" onClick={() => toggleSpec(s)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 14px',
                  background: active ? '#0F0F0F' : '#fff',
                  border: `1.5px solid ${active ? '#0F0F0F' : 'var(--border)'}`,
                  borderRadius: 999, fontSize: 12.5, fontWeight: active ? 600 : 400,
                  color: active ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.14s',
                }}
              >
                {active && (
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5L6.5 12L13 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Password section ───────────────────────── */}
      <div className="card" style={{ padding: '28px 28px 24px', marginTop: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '0 0 20px' }}>
          Change Password
        </h2>

        <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Current password */}
          <div>
            <label style={LABEL}>Current password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input-field"
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                onBlur={() => setCurrentPwTouched(true)}
                placeholder="Enter current password"
                autoComplete="current-password"
                style={{ paddingRight: 38, borderColor: currentPwTouched && !currentPw ? 'rgba(185,28,28,0.5)' : undefined }}
              />
              <button type="button" onClick={() => setShowCurrentPw((v) => !v)} tabIndex={-1}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center' }}>
                {showCurrentPw ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* New password + checklist */}
          <div>
            <label style={LABEL}>New password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input-field"
                type={showNewPw ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                style={{ paddingRight: 38 }}
              />
              <button type="button" onClick={() => setShowNewPw((v) => !v)} tabIndex={-1}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center' }}>
                {showNewPw ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {newPw.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 8 }}>
                {([
                  { key: 'length',    label: '8+ characters' },
                  { key: 'uppercase', label: 'Uppercase letter' },
                  { key: 'number',    label: 'Number' },
                  { key: 'special',   label: 'Special character' },
                ] as { key: keyof typeof pwChecks; label: string }[]).map(({ key, label }) => (
                  <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: pwChecks[key] ? '#2d7a4f' : '#8C8984' }}>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                      {pwChecks[key]
                        ? <path d="M3 8.5L6.5 12L13 4" stroke="#2d7a4f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        : <circle cx="8" cy="8" r="6" stroke="#C8C3BD" strokeWidth="1.5" />
                      }
                    </svg>
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label style={LABEL}>Confirm new password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input-field"
                type={showConfirmPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
                style={{
                  paddingRight: 38,
                  borderColor: confirmMismatch ? 'rgba(185,28,28,0.5)' : confirmMatch ? 'rgba(45,122,79,0.5)' : undefined,
                }}
              />
              <button type="button" onClick={() => setShowConfirmPw((v) => !v)} tabIndex={-1}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center' }}>
                {showConfirmPw ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {confirmMismatch && <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#b91c1c' }}>Passwords do not match.</p>}
            {confirmMatch    && <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#2d7a4f' }}>Passwords match.</p>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="submit" className="btn-ghost" disabled={pwSaving || !pwValid || !confirmMatch || !currentPw} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {pwSaving && <svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>}
              {pwSaving ? 'Sending code…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>

      {/* ── OTP Verification Modal ────────────────── */}
      {showOtpModal && (
        <OtpModal
          digits={otpDigits}
          onDigitsChange={setOtpDigits}
          onVerify={handleVerifyOtp}
          onResend={handleResendOtp}
          onCancel={() => setShowOtpModal(false)}
          verifying={otpVerifying}
          error={otpError}
          resendCooldown={resendCooldown}
          onCooldownTick={() => setResendCooldown((v) => Math.max(0, v - 1))}
        />
      )}

      {/* ── Account section ────────────────────────── */}
      <div className="card" style={{ padding: '28px 28px 24px', marginTop: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '0 0 16px' }}>
          Account
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Status</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>Your account approval status</div>
            </div>
            <StatusBadge status={profile?.status ?? ''} />
          </div>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Member since</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Danger zone ────────────────────────────── */}
      <div style={{
        marginTop: 20, padding: '24px 28px',
        border: '1px solid rgba(185,28,28,0.15)',
        borderRadius: 12, background: 'rgba(185,28,28,0.02)',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c', letterSpacing: '-0.02em', margin: '0 0 8px' }}>
          Danger Zone
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button
          onClick={() => setShowDelete(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            border: '1px solid rgba(185,28,28,0.25)', borderRadius: 8,
            background: 'transparent', color: '#b91c1c',
            padding: '9px 16px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(185,28,28,0.06)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6M9 6V4h6v2" />
          </svg>
          Delete account
        </button>
      </div>

      {/* ── Delete modal ───────────────────────────── */}
      {showDelete && (
        <DeleteAccountModal
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDelete(false)}
          loading={deleting}
        />
      )}

      {/* ── Toast ──────────────────────────────────── */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ── OTP Modal ────────────────────────────────────── */

interface OtpModalProps {
  digits: string[];
  onDigitsChange: (d: string[]) => void;
  onVerify: () => void;
  onResend: () => void;
  onCancel: () => void;
  verifying: boolean;
  error: string;
  resendCooldown: number;
  onCooldownTick: () => void;
}

function OtpModal({ digits, onDigitsChange, onVerify, onResend, onCancel, verifying, error, resendCooldown, onCooldownTick }: OtpModalProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(onCooldownTick, 1000);
    return () => clearTimeout(t);
  }, [resendCooldown, onCooldownTick]);

  // Auto-submit when all 6 digits filled
  useEffect(() => {
    if (digits.every((d) => d !== '') && !verifying) {
      onVerify();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  function handleInput(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    onDigitsChange(next);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        onDigitsChange(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    onDigitsChange(next);
    const focusIdx = Math.min(text.length, 5);
    inputRefs.current[focusIdx]?.focus();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onCancel}
    >
      <div className="anim-scale-in" onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, padding: '32px 28px 28px', width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

        {/* Icon + title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F8F7F4', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F0F0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F0F0F', letterSpacing: '-0.02em', margin: 0 }}>Check your email</h3>
          <p style={{ fontSize: 13, color: '#8C8984', margin: '6px 0 0', textAlign: 'center', lineHeight: 1.5 }}>
            We sent a 6-digit code to your email. Enter it below to confirm the password change.
          </p>
        </div>

        {/* OTP digit boxes */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }} onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleInput(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={verifying}
              style={{
                width: 44, height: 52, textAlign: 'center',
                fontSize: 22, fontWeight: 700, fontFamily: 'inherit',
                border: `1.5px solid ${error ? 'rgba(185,28,28,0.4)' : d ? '#0F0F0F' : 'var(--border)'}`,
                borderRadius: 8, outline: 'none', background: verifying ? '#f8f8f8' : '#fff',
                color: '#0F0F0F',
                transition: 'border-color 0.12s',
              }}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p style={{ textAlign: 'center', fontSize: 12.5, color: '#b91c1c', margin: '0 0 12px' }}>{error}</p>
        )}

        {/* Loading state */}
        {verifying && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
            <svg className="anim-rotate" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
            Verifying…
          </div>
        )}

        {/* Resend + cancel */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <button type="button" onClick={onCancel}
            style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button type="button" onClick={onResend} disabled={resendCooldown > 0}
            style={{ background: 'none', border: 'none', fontSize: 13, color: resendCooldown > 0 ? 'var(--text-muted)' : '#0F0F0F', cursor: resendCooldown > 0 ? 'default' : 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: 600 }}>
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    approved:       { label: 'Approved',       color: '#2d7a4f', bg: '#e8f5ee' },
    pending_review: { label: 'Pending Review', color: '#7a5c2d', bg: '#fdf5e6' },
    rejected:       { label: 'Rejected',       color: '#8b2635', bg: '#fdecea' },
    suspended:      { label: 'Suspended',      color: '#555',    bg: '#f0f0f0' },
  };
  const s = map[status] ?? { label: status, color: '#555', bg: '#f0f0f0' };
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em',
      color: s.color, background: s.bg,
      padding: '4px 10px', borderRadius: 20, textTransform: 'uppercase',
    }}>
      {s.label}
    </span>
  );
}
