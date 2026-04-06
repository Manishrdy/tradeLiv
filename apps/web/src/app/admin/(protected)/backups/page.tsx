'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, BackupConfig, BackupRun, BackupStats } from '@/lib/api';

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  success: { color: '#2d7a4f', bg: '#e8f5ee' },
  failed:  { color: '#b91c1c', bg: '#fee2e2' },
  running: { color: '#7a5c2d', bg: '#fdf5e6' },
};

const TRIGGER_LABEL: Record<string, string> = {
  scheduled:       'Scheduled',
  manual:          'Manual',
  'pre-migration': 'Pre-Migration',
  restart:         'Server Restart',
};

function formatBytes(bytes: number | string | null): string {
  if (bytes === null || bytes === undefined) return '—';
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function nextRunLabel(intervalHours: number): string {
  const now = new Date();
  const next = new Date(now);
  next.setHours(Math.ceil(now.getHours() / intervalHours) * intervalHours, 0, 0, 0);
  if (next <= now) next.setHours(next.getHours() + intervalHours);
  return next.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

type StatusFilter = 'all' | 'success' | 'failed' | 'running';

export default function AdminBackupsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggeringPre, setTriggeringPre] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [form, setForm] = useState({ enabled: true, intervalHours: 6, ttlDays: 7 });

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadStats = useCallback(async () => {
    const res = await api.getBackupStats();
    if (res.data) setStats(res.data);
  }, []);

  const loadRuns = useCallback(async () => {
    const res = await api.getBackupRuns(50);
    if (res.data) setRuns(res.data);
  }, []);

  useEffect(() => {
    api.getAdminMe().then((r) => {
      if (!r.data?.isSuperAdmin) { router.replace('/admin/dashboard'); return; }
      setAuthorized(true);
      Promise.all([api.getBackupConfig(), api.getBackupRuns(50), api.getBackupStats()]).then(([cfgRes, runsRes, statsRes]) => {
        if (cfgRes.data) {
          setConfig(cfgRes.data);
          setForm({ enabled: cfgRes.data.enabled, intervalHours: cfgRes.data.intervalHours, ttlDays: cfgRes.data.ttlDays });
        }
        if (runsRes.data) setRuns(runsRes.data);
        if (statsRes.data) setStats(statsRes.data);
        setLoading(false);
      });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => { loadRuns(); loadStats(); }, 10_000);
    return () => clearInterval(id);
  }, [loadRuns, loadStats]);

  async function handleSaveConfig() {
    setSaving(true);
    const res = await api.updateBackupConfig(form);
    if (res.data) { setConfig(res.data); showToast('Config saved — schedule reloaded'); }
    else showToast('Failed to save config', false);
    setSaving(false);
  }

  async function handleTrigger(trigger: 'manual' | 'pre-migration' = 'manual') {
    if (trigger === 'pre-migration') setTriggeringPre(true);
    else setTriggering(true);
    const res = await api.triggerBackup(trigger);
    if (res.data) {
      showToast('Backup started — check run history below');
      setTimeout(() => { loadRuns(); loadStats(); }, 3000);
    } else showToast('Failed to start backup', false);
    if (trigger === 'pre-migration') setTriggeringPre(false);
    else setTriggering(false);
  }

  async function handleDelete(run: BackupRun) {
    if (!confirm(`Delete backup ${run.driveFileName ?? run.id}?`)) return;
    setDeletingId(run.id);
    const res = await api.deleteBackupRun(run.id);
    if (res.data) { setRuns((prev) => prev.filter((r) => r.id !== run.id)); showToast('Backup deleted'); loadStats(); }
    else showToast('Failed to delete backup', false);
    setDeletingId(null);
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (!confirm(`Delete ${ids.length} backup(s)?`)) return;
    setBulkDeleting(true);
    const res = await api.bulkDeleteBackupRuns(ids);
    if (res.data) {
      setRuns((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      showToast(`${res.data.deleted} backup(s) deleted`);
      loadStats();
    } else showToast('Bulk delete failed', false);
    setBulkDeleting(false);
  }

  async function handleRestore(run: BackupRun) {
    if (!confirm(`Restore database from "${run.driveFileName}"?\n\nThis will OVERWRITE the current dev database. This cannot be undone.`)) return;
    if (!confirm('Are you absolutely sure? All current data will be replaced.')) return;
    setRestoringId(run.id);
    const res = await api.restoreBackup(run.id);
    if (res.data) showToast(res.data.message);
    else showToast('Restore failed — check server logs', false);
    setRestoringId(null);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll(filtered: BackupRun[]) {
    if (filtered.every((r) => selectedIds.has(r.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  }

  const filteredRuns = runs.filter((r) => statusFilter === 'all' || r.status === statusFilter);
  const allSelected = filteredRuns.length > 0 && filteredRuns.every((r) => selectedIds.has(r.id));

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

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 1000,
          background: toast.ok ? '#2d7a4f' : '#b91c1c', color: '#fff',
          padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Error modal */}
      {errorModal && (
        <div
          onClick={() => setErrorModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 24, maxWidth: 540, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#b91c1c', marginBottom: 12 }}>Error Details</div>
            <pre style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>{errorModal}</pre>
            <button
              onClick={() => setErrorModal(null)}
              style={{ marginTop: 16, background: 'var(--border)', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            Database Backups
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
            Automated pg_dump — stored in <code style={{ fontSize: 12, background: 'var(--border)', padding: '1px 6px', borderRadius: 4 }}>apps/api/db-backups/</code>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => handleTrigger('pre-migration')}
            disabled={triggeringPre}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#7a5c2d', color: '#fff',
              border: 'none', borderRadius: 8, padding: '8px 16px',
              fontSize: 12.5, fontWeight: 700, cursor: triggeringPre ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', opacity: triggeringPre ? 0.6 : 1,
            }}
          >
            {triggeringPre ? 'Starting…' : '⚡ Pre-Migration'}
          </button>
          <button
            onClick={() => handleTrigger('manual')}
            disabled={triggering}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--text-primary)', color: '#fff',
              border: 'none', borderRadius: 8, padding: '8px 16px',
              fontSize: 12.5, fontWeight: 700, cursor: triggering ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', opacity: triggering ? 0.6 : 1,
            }}
          >
            {triggering ? 'Starting…' : '▶ Run Now'}
          </button>
        </div>
      </div>

      {/* Disk warning */}
      {stats?.overThreshold && (
        <div style={{
          background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8,
          padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#92400e', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ⚠ Backup folder exceeds 500 MB — consider reducing TTL or running a bulk delete.
        </div>
      )}

      {/* Stats cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Size', value: formatBytes(stats.totalSizeBytes) },
            { label: 'Files on Disk', value: String(stats.totalFiles) },
            { label: 'Success Rate', value: `${stats.successRate}%` },
            { label: 'Last Success', value: stats.lastSuccessAt ? new Date(stats.lastSuccessAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="card" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule config */}
      <div className="card" style={{ padding: 24, marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>Schedule Config</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '16px 24px', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, gridColumn: '1 / -1' }}>
            <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 22 }}>
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{ position: 'absolute', inset: 0, borderRadius: 11, background: form.enabled ? '#2d7a4f' : 'var(--border)', transition: 'background 0.2s', cursor: 'pointer' }}>
                <span style={{ position: 'absolute', top: 3, left: form.enabled ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </span>
            </label>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
              {form.enabled ? 'Backups enabled' : 'Backups disabled'}
            </span>
          </div>

          <div>
            <label style={labelStyle}>Interval (hours)</label>
            <select value={form.intervalHours} onChange={(e) => setForm({ ...form, intervalHours: Number(e.target.value) })} style={inputStyle}>
              {[1, 2, 3, 4, 6, 8, 12, 24].map((h) => <option key={h} value={h}>Every {h}h</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Keep backups for</label>
            <select value={form.ttlDays} onChange={(e) => setForm({ ...form, ttlDays: Number(e.target.value) })} style={inputStyle}>
              {[3, 7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
        </div>

        {config && (
          <div style={{ display: 'flex', gap: 24, marginBottom: 18, fontSize: 12.5, color: 'var(--text-muted)' }}>
            <span>Next run: <strong style={{ color: 'var(--text-primary)' }}>{nextRunLabel(form.intervalHours)}</strong></span>
            <span>Last saved: <strong style={{ color: 'var(--text-primary)' }}>{new Date(config.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</strong></span>
          </div>
        )}

        <button onClick={handleSaveConfig} disabled={saving} style={{ background: '#2d5f7a', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 20px', fontSize: 12.5, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save Config'}
        </button>
      </div>

      {/* Run history */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Run History</div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', background: '#fee2e2', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {bulkDeleting ? 'Deleting…' : `Delete ${selectedIds.size} selected`}
              </button>
            )}
            {/* Filter tabs */}
            <div style={{ display: 'flex', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
              {(['all', 'success', 'failed', 'running'] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  style={{
                    padding: '5px 12px', fontSize: 11.5, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: statusFilter === f ? 'var(--text-primary)' : 'transparent',
                    color: statusFilter === f ? '#fff' : 'var(--text-muted)',
                    textTransform: 'capitalize',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredRuns.length === 0 ? (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>
            {runs.length === 0 ? 'No backups yet. Click "Run Now" to take your first backup.' : `No ${statusFilter} backups.`}
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px', width: 32 }}>
                    <input type="checkbox" checked={allSelected} onChange={() => toggleSelectAll(filteredRuns)} style={{ cursor: 'pointer' }} />
                  </th>
                  {['Started', 'Env', 'Trigger', 'Status', 'Size', 'Duration', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((run) => {
                  const sc = STATUS_STYLE[run.status] ?? { color: '#555', bg: '#f0f0f0' };
                  return (
                    <tr key={run.id} style={{ borderBottom: '1px solid var(--border)', background: selectedIds.has(run.id) ? 'var(--bg-input)' : 'transparent' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <input type="checkbox" checked={selectedIds.has(run.id)} onChange={() => toggleSelect(run.id)} style={{ cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {new Date(run.startedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: run.env === 'prod' ? '#fde8e8' : '#e8f0fe', color: run.env === 'prod' ? '#b91c1c' : '#1d4ed8', textTransform: 'uppercase' }}>
                          {run.env}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {TRIGGER_LABEL[run.trigger] ?? run.trigger}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: sc.bg, color: sc.color, textTransform: 'uppercase' }}>
                          {run.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {formatBytes(run.fileSizeBytes)}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {formatDuration(run.durationMs)}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'nowrap' }}>
                          {run.status === 'success' && run.driveFileName && (
                            <>
                              <button onClick={() => { window.location.href = api.getBackupDownloadUrl(run.id); }} style={actionBtn('#2d5f7a')}>
                                ↓ Download
                              </button>
                              <button
                                onClick={() => handleRestore(run)}
                                disabled={restoringId === run.id}
                                style={actionBtn('#7a2d2d', restoringId === run.id)}
                              >
                                {restoringId === run.id ? 'Restoring…' : '↺ Restore'}
                              </button>
                            </>
                          )}
                          {run.error && (
                            <button onClick={() => setErrorModal(run.error!)} style={actionBtn('#b91c1c')}>
                              Error ⓘ
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(run)}
                            disabled={deletingId === run.id}
                            style={actionBtn('#999', deletingId === run.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  border: '1px solid var(--border)', borderRadius: 6,
  background: 'var(--bg-input)', color: 'var(--text-primary)',
  fontFamily: 'inherit', outline: 'none',
};

function actionBtn(color: string, disabled = false): React.CSSProperties {
  return {
    fontSize: 11.5, color, fontWeight: 600,
    background: 'none', border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    padding: 0, fontFamily: 'inherit',
    opacity: disabled ? 0.5 : 1,
    whiteSpace: 'nowrap',
  };
}
