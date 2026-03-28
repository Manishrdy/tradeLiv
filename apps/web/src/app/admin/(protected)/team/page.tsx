'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, AdminUser, AdminDesigner } from '@/lib/api';

export default function AdminTeamPage() {
  const router = useRouter();
  const [admins, setAdmins]     = useState<AdminUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [showAdd, setShowAdd]   = useState(false);
  const [mode, setMode]         = useState<'promote' | 'create'>('promote');
  const [designers, setDesigners] = useState<AdminDesigner[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm]         = useState({ email: '', password: '', fullName: '' });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.getAdminAdmins().then((r) => {
      if (r.data) setAdmins(r.data);
      setLoading(false);
    });
  }, []);

  // Gate: only super admins can access this page
  useEffect(() => {
    api.getAdminMe().then((r) => {
      if (r.data?.isSuperAdmin) {
        setAuthorized(true);
        load();
      } else {
        router.replace('/admin/dashboard');
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openAdd() {
    setShowAdd(true);
    setError('');
    setMode('promote');
    setSelectedId('');
    setForm({ email: '', password: '', fullName: '' });
    // Load non-admin designers for promotion
    api.getAdminDesigners({ status: 'approved', limit: 100 }).then((r) => {
      if (r.data) setDesigners(r.data.designers.filter((d) => !d.isAdmin));
    });
  }

  async function handleAdd() {
    setSaving(true);
    setError('');
    try {
      const payload = mode === 'promote'
        ? { designerId: selectedId }
        : { email: form.email, password: form.password, fullName: form.fullName };

      const r = await api.createAdmin(payload);
      if (r.error) {
        setError(r.error);
      } else {
        setShowAdd(false);
        load();
      }
    } catch {
      setError('An error occurred.');
    }
    setSaving(false);
  }

  async function handleRemove(id: string, name: string) {
    if (!confirm(`Revoke admin privileges from ${name}?`)) return;
    const r = await api.removeAdmin(id);
    if (r.error) {
      alert(r.error);
    } else {
      load();
    }
  }

  if (!authorized || loading) {
    return (
      <div style={{ padding: '60px 40px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13.5 }}>
        <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 40px 80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            Admin Team
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
            Manage who has admin access to the platform.
          </p>
        </div>
        <button className="btn-primary" style={{ fontSize: 13, padding: '9px 18px' }} onClick={openAdd}>
          + Add Admin
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Name', 'Email', 'Role', 'Added', ''].map((h) => (
                <th key={h} style={{
                  padding: '10px 16px', textAlign: 'left',
                  fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr
                key={a.id}
                style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-input)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = '')}
              >
                <td style={{ padding: '12px 16px', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {a.fullName}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                  {a.email}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
                    color: a.isSuperAdmin ? '#7a5c2d' : '#2d7a4f',
                    background: a.isSuperAdmin ? '#fdf5e6' : '#e8f5ee',
                    padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase',
                  }}>
                    {a.isSuperAdmin ? 'Super Admin' : 'Admin'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  {!a.isSuperAdmin && (
                    <button
                      onClick={() => handleRemove(a.id, a.fullName)}
                      style={{
                        fontSize: 12, fontWeight: 600, color: '#8b2635',
                        background: 'none', border: '1px solid #fdecea',
                        padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Admin Modal */}
      {showAdd && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}
        >
          <div className="card" style={{ width: 440, padding: '28px 30px' }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '0 0 20px' }}>
              Add Admin
            </h3>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
              {(['promote', 'create'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 7,
                    border: '1px solid var(--border)', cursor: 'pointer',
                    background: mode === m ? 'var(--text-primary)' : 'transparent',
                    color: mode === m ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {m === 'promote' ? 'Promote Designer' : 'Create New'}
                </button>
              ))}
            </div>

            {mode === 'promote' ? (
              <div>
                <label className="form-label">Select designer to promote</label>
                <select
                  className="input-field"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  style={{ fontSize: 13 }}
                >
                  <option value="">Choose a designer...</option>
                  {designers.map((d) => (
                    <option key={d.id} value={d.id}>{d.fullName} ({d.email})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="form-label">Full Name</label>
                  <input className="input-field" type="text" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} style={{ fontSize: 13 }} />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ fontSize: 13 }} />
                </div>
                <div>
                  <label className="form-label">Password</label>
                  <input className="input-field" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={{ fontSize: 13 }} />
                  {form.password.length > 0 && form.password.length < 8 && (
                    <p style={{ fontSize: 11.5, color: '#b91c1c', marginTop: 5 }}>
                      Password must be at least 8 characters.
                    </p>
                  )}
                </div>
              </div>
            )}

            {error && <div className="error-box" style={{ marginTop: 14 }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
              <button className="btn-ghost" onClick={() => setShowAdd(false)} style={{ fontSize: 13 }}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleAdd}
                disabled={saving || (mode === 'promote' ? !selectedId : !form.email || form.password.length < 8 || !form.fullName)}
                style={{ fontSize: 13, padding: '9px 18px', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Adding...' : 'Add Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
