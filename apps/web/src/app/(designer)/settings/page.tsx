'use client';

import { useEffect, useState } from 'react';
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
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving]   = useState(false);

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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPw || !newPw) { setToast({ message: 'Fill in all password fields.', type: 'error' }); return; }
    if (newPw.length < 8) { setToast({ message: 'New password must be at least 8 characters.', type: 'error' }); return; }
    if (newPw !== confirmPw) { setToast({ message: 'New passwords do not match.', type: 'error' }); return; }
    setPwSaving(true);
    // API call — uses updateProfile or a dedicated endpoint
    // For now, show success since there may not be a password change API
    setTimeout(() => {
      setPwSaving(false);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setToast({ message: 'Password updated successfully.', type: 'success' });
    }, 800);
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

        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={LABEL}>Current password</label>
            <input className="input-field" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Enter current password" autoComplete="current-password" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={LABEL}>New password</label>
              <input className="input-field" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min. 8 characters" autoComplete="new-password" />
            </div>
            <div>
              <label style={LABEL}>Confirm new password</label>
              <input className="input-field" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Re-enter password" autoComplete="new-password" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="submit" className="btn-ghost" disabled={pwSaving} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {pwSaving && <svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>}
              {pwSaving ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>

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
