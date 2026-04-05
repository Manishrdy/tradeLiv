'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, PlatformConfigEntry } from '@/lib/api';

const GROUP_COLORS: Record<string, { color: string; bg: string }> = {
  general:    { color: '#2d5f7a', bg: '#e6f0fd' },
  tax:        { color: '#7a5c2d', bg: '#fdf5e6' },
  payment:    { color: '#2d7a4f', bg: '#e8f5ee' },
  commission: { color: '#7a2d6b', bg: '#fde6f9' },
};

export default function AdminConfigPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<PlatformConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newConfig, setNewConfig] = useState({ key: '', value: '', type: 'string', label: '', group: 'general' });

  // Gate: only super admins can access this page
  useEffect(() => {
    api.getAdminMe().then((r) => {
      if (r.data?.isSuperAdmin) {
        setAuthorized(true);
        api.getAdminConfig().then((cr) => {
          if (cr.data) setConfigs(cr.data);
          setLoading(false);
        });
      } else {
        router.replace('/admin/dashboard');
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(key: string) {
    setSaving(true);
    const res = await api.updateAdminConfig(key, editValue);
    if (res.data) {
      setConfigs((prev) => prev.map((c) => c.key === key ? res.data! : c));
      setEditingKey(null);
    }
    setSaving(false);
  }

  async function handleCreate() {
    if (!newConfig.key || !newConfig.label) return;
    setSaving(true);
    const res = await api.createAdminConfig(newConfig);
    if (res.data) {
      setConfigs((prev) => [...prev, res.data!]);
      setShowAdd(false);
      setNewConfig({ key: '', value: '', type: 'string', label: '', group: 'general' });
    }
    setSaving(false);
  }

  // Group configs
  const grouped = configs.reduce<Record<string, PlatformConfigEntry[]>>((acc, c) => {
    if (!acc[c.group]) acc[c.group] = [];
    acc[c.group].push(c);
    return acc;
  }, {});

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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            Platform Config
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
            Manage platform-wide settings
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'var(--text-primary)', color: '#fff',
            border: 'none', borderRadius: 8, padding: '8px 16px',
            fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          + Add Config
        </button>
      </div>

      {/* Add new config form */}
      {showAdd && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>New Config Entry</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Key</label>
              <input
                value={newConfig.key} onChange={(e) => setNewConfig({ ...newConfig, key: e.target.value })}
                placeholder="config_key" style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Label</label>
              <input
                value={newConfig.label} onChange={(e) => setNewConfig({ ...newConfig, label: e.target.value })}
                placeholder="Tax Rate" style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Value</label>
              <input
                value={newConfig.value} onChange={(e) => setNewConfig({ ...newConfig, value: e.target.value })}
                placeholder="0.08" style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Group</label>
              <select
                value={newConfig.group} onChange={(e) => setNewConfig({ ...newConfig, group: e.target.value })}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="general">General</option>
                <option value="tax">Tax</option>
                <option value="payment">Payment</option>
                <option value="commission">Commission</option>
              </select>
            </div>
            <button onClick={handleCreate} disabled={saving} style={{
              background: '#2d7a4f', color: '#fff', border: 'none', borderRadius: 6,
              padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              opacity: saving ? 0.5 : 1, whiteSpace: 'nowrap',
            }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {configs.length === 0 ? (
        <div className="card" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>
          No configuration entries yet. Click &quot;Add Config&quot; to create one.
        </div>
      ) : (
        Object.entries(grouped).map(([group, items]) => {
          const gc = GROUP_COLORS[group] ?? { color: '#555', bg: '#f0f0f0' };
          return (
            <div key={group} style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
                  color: gc.color, background: gc.bg,
                  padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase',
                }}>
                  {group}
                </span>
              </div>

              <div className="card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Key', 'Label', 'Value', 'Type', 'Updated', ''].map((h) => (
                        <th key={h} style={{
                          padding: '10px 14px', textAlign: 'left',
                          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((c) => (
                      <tr key={c.key} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                          {c.key}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{c.label}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {editingKey === c.key ? (
                            <input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(c.key); if (e.key === 'Escape') setEditingKey(null); }}
                              autoFocus
                              style={{ ...inputStyle, width: '100%', maxWidth: 200 }}
                            />
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {c.type === 'boolean' ? (c.value === 'true' ? 'Yes' : 'No') : c.value}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                            background: 'var(--bg-input)', color: 'var(--text-muted)', textTransform: 'uppercase',
                          }}>
                            {c.type}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(c.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          {editingKey === c.key ? (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => handleSave(c.key)} disabled={saving}
                                style={{
                                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                                  border: '1px solid var(--green-border)', background: 'var(--green-dim)',
                                  color: 'var(--green)', cursor: 'pointer', fontFamily: 'inherit',
                                }}
                              >
                                {saving ? '...' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditingKey(null)}
                                style={{
                                  fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                                  border: '1px solid var(--border)', background: 'transparent',
                                  color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingKey(c.key); setEditValue(c.value); }}
                              style={{
                                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                                border: '1px solid var(--border)', background: 'transparent',
                                color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
                              }}
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: 13,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  outline: 'none',
};
