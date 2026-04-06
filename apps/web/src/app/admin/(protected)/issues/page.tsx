'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, AdminErrorIssue } from '@/lib/api';

const STATE_TABS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

const SEVERITY_TABS = [
  { value: '', label: 'All severity' },
  { value: 'critical', label: 'Critical' },
  { value: 'error', label: 'Error' },
  { value: 'warn', label: 'Warn' },
];

const ISSUE_STATE_STYLE: Record<string, { color: string; bg: string }> = {
  open: { color: '#2d7a4f', bg: '#e8f5ee' },
  closed: { color: '#5b6470', bg: '#eef1f5' },
};

const SEVERITY_STYLE: Record<string, { color: string; bg: string }> = {
  critical: { color: '#b91c1c', bg: '#fee2e2' },
  error: { color: '#9a3412', bg: '#ffedd5' },
  warn: { color: '#854d0e', bg: '#fef3c7' },
};

function Badge({ value, map, fallback }: { value: string; map: Record<string, { color: string; bg: string }>; fallback?: string }) {
  const v = (value || fallback || '').toLowerCase();
  const style = map[v] ?? { color: '#555', bg: '#f3f4f6' };
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: style.color,
        background: style.bg,
        padding: '3px 9px',
        borderRadius: 20,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {value || fallback}
    </span>
  );
}

type SyncResult = { synced: number; unchanged: number; failed: number; total: number };

export default function AdminIssuesPage() {
  const [issues, setIssues] = useState<AdminErrorIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState('');
  const [severity, setSeverity] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const load = useCallback((s: string, sev: string, q: string, p: number) => {
    setLoading(true);
    api.getAdminErrorIssues({
      state: (s || undefined) as 'open' | 'closed' | undefined,
      severity: (sev || undefined) as 'warn' | 'error' | 'critical' | undefined,
      search: q || undefined,
      page: p,
      limit: 25,
    }).then((r) => {
      if (r.data) {
        setIssues(r.data.issues);
        setTotalPages(r.data.totalPages);
        setTotal(r.data.total);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load(state, severity, search, page);
  }, [state, severity, search, page, load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    const r = await api.syncAdminErrorIssues();
    setSyncing(false);
    if (r.data) {
      setSyncResult(r.data);
      if (r.data.synced > 0) {
        load(state, severity, search, page);
      }
    } else {
      setSyncError(r.error ?? 'Sync failed. Please try again.');
    }
  }

  function formatDate(value: string | null) {
    if (!value) return '—';
    return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div style={{ padding: '40px 40px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            Error Issues
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
            DB-backed incident list synced with GitHub issue state.
          </p>
        </div>
        <button
          className="btn-ghost"
          onClick={handleSync}
          disabled={syncing}
          style={{ fontSize: 13, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          {syncing ? (
            <svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <polyline points="23 20 23 14 17 14" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
          )}
          {syncing ? 'Syncing…' : 'Sync with GitHub'}
        </button>
      </div>

      {syncResult && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 16px',
            borderRadius: 8,
            background: syncResult.failed > 0 ? '#fef3c7' : '#e8f5ee',
            border: `1px solid ${syncResult.failed > 0 ? '#fcd34d' : '#86efac'}`,
            fontSize: 13,
            color: syncResult.failed > 0 ? '#854d0e' : '#166534',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>
            Sync complete — <strong>{syncResult.synced}</strong> updated, <strong>{syncResult.unchanged}</strong> unchanged
            {syncResult.failed > 0 && <>, <strong>{syncResult.failed}</strong> failed to fetch from GitHub</>}
            {' '}({syncResult.total} total tracked issues)
          </span>
          <button
            onClick={() => setSyncResult(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, color: 'inherit', padding: '0 2px' }}
          >
            ×
          </button>
        </div>
      )}

      {syncError && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 16px',
            borderRadius: 8,
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            fontSize: 13,
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>{syncError}</span>
          <button
            onClick={() => setSyncError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, color: 'inherit', padding: '0 2px' }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
        {STATE_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => { setState(t.value); setPage(1); }}
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              padding: '8px 14px',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              color: state === t.value ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: state === t.value ? '2px solid var(--text-primary)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {SEVERITY_TABS.map((s) => (
          <button
            key={s.value}
            onClick={() => { setSeverity(s.value); setPage(1); }}
            className="btn-ghost"
            style={{
              fontSize: 12,
              padding: '6px 12px',
              opacity: severity === s.value ? 1 : 0.75,
              borderColor: severity === s.value ? 'var(--text-primary)' : 'var(--border)',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <input
          className="input-field"
          type="text"
          placeholder="Search by message, file, route, env..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{ width: 360, fontSize: 13 }}
        />
        <button type="submit" className="btn-ghost" style={{ fontSize: 13, padding: '8px 14px' }}>Search</button>
        {search && (
          <button type="button" className="btn-ghost" style={{ fontSize: 13, padding: '8px 10px' }} onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}>
            ×
          </button>
        )}
      </form>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13.5, padding: '40px 0' }}>
          <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading...
        </div>
      ) : issues.length === 0 ? (
        <div className="card" style={{ padding: '50px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>
          No issues found
        </div>
      ) : (
        <>
          <div className="card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1080 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['State', 'Severity', 'Message', 'Location', 'Env', 'Count', 'First Seen', 'Last Seen', 'GitHub'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 14px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={issue.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <Badge value={issue.githubIssueState} map={ISSUE_STATE_STYLE} fallback="open" />
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <Badge value={issue.severity} map={SEVERITY_STYLE} />
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-primary)', maxWidth: 360 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {issue.normalizedErrorMessage}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {issue.fingerprint.slice(0, 14)}...
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      <div style={{ whiteSpace: 'nowrap' }}>{issue.httpMethod || 'N/A'} {issue.routePath || 'N/A'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{issue.fileName}</div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      {issue.useDbEnv || 'unknown'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {issue.occurrenceCount}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDate(issue.firstSeenAt)}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDate(issue.lastSeenAt)}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12.5 }}>
                      {issue.githubIssueUrl ? (
                        <a
                          href={issue.githubIssueUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}
                        >
                          #{issue.githubIssueNumber}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Not linked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{total} issue{total !== 1 ? 's' : ''}</span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ fontSize: 12, padding: '6px 12px' }}>
                  Previous
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '32px' }}>
                  Page {page} of {totalPages}
                </span>
                <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ fontSize: 12, padding: '6px 12px' }}>
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
