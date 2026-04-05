'use client';

import { Fragment, useEffect, useState } from 'react';
import { api, TimeTrackingSummary, DesignerSessionDetail } from '@/lib/api';

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: color ?? 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function formatDuration(ms: number) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminTimeTrackingPage() {
  const [data, setData] = useState<TimeTrackingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedDesigner, setExpandedDesigner] = useState<string | null>(null);
  const [sessions, setSessions] = useState<DesignerSessionDetail[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  function fetchData() {
    setLoading(true);
    const params: { from?: string; to?: string } = {};
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    api.getAdminTimeTracking(params).then((r) => {
      if (r.data) setData(r.data);
      setLoading(false);
    });
  }

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleDesignerSessions(designerId: string) {
    if (expandedDesigner === designerId) {
      setExpandedDesigner(null);
      setSessions([]);
      return;
    }
    setExpandedDesigner(designerId);
    setLoadingSessions(true);
    const res = await api.getAdminDesignerSessions(designerId);
    if (res.data) setSessions(res.data);
    setLoadingSessions(false);
  }

  if (loading) {
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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            Time Tracking
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
            Designer platform activity
          </p>
        </div>

        {/* Date range filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="date" value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={dateInputStyle}
          />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
          <input
            type="date" value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={dateInputStyle}
          />
          <button onClick={fetchData} style={{
            background: 'var(--text-primary)', color: '#fff',
            border: 'none', borderRadius: 6, padding: '6px 14px',
            fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Filter
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
            <StatCard label="Active Now" value={data.activeSessions} color="#2d7a4f" sub="Live sessions" />
            <StatCard label="Total Platform Time" value={formatDuration(data.totalTimeAllMs)} sub="All designers" />
            <StatCard label="Designers Tracked" value={data.designers.length} />
          </div>

          {/* Designer table */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Designer Activity
            </h2>
            {data.designers.length > 0 && (
              <button
                onClick={() => exportCSV('time-tracking.csv',
                  ['Designer', 'Total Time', 'Sessions', 'Avg Session', 'Last Active'],
                  data.designers.map((d) => [d.designerName, formatDuration(d.totalTimeMs), String(d.sessionCount), formatDuration(d.avgSessionMs), d.lastActive])
                )}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '4px 10px',
                  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export CSV
              </button>
            )}
          </div>

          {data.designers.length === 0 ? (
            <div className="card" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>
              No session data yet. Sessions are tracked when designers use the platform.
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Designer', 'Total Time', 'Sessions', 'Avg Session', 'Last Active', ''].map((h) => (
                      <th key={h} style={{
                        padding: '10px 14px', textAlign: 'left',
                        fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.designers.map((d) => (
                    <Fragment key={d.designerId}>
                      <tr style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                        onClick={() => toggleDesignerSessions(d.designerId)}
                      >
                        <td style={{ padding: '12px 14px', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {d.designerName}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#2d5f7a' }}>
                          {formatDuration(d.totalTimeMs)}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{d.sessionCount}</td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
                          {formatDuration(d.avgSessionMs)}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {formatDateTime(d.lastActive)}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                            style={{ transform: expandedDesigner === d.designerId ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted)' }}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </td>
                      </tr>

                      {/* Expanded session detail */}
                      {expandedDesigner === d.designerId && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <div style={{ background: 'var(--bg-input)', padding: '12px 20px 12px 40px' }}>
                              {loadingSessions ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12.5, padding: '8px 0' }}>
                                  <svg className="anim-rotate" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                                  </svg>
                                  Loading sessions...
                                </div>
                              ) : sessions.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: 12.5, padding: '8px 0' }}>
                                  No session data available.
                                </div>
                              ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr>
                                      {['Started', 'Ended', 'Duration', 'Status'].map((h) => (
                                        <th key={h} style={{
                                          padding: '6px 10px', textAlign: 'left',
                                          fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                                          textTransform: 'uppercase', letterSpacing: '0.06em',
                                        }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sessions.slice(0, 15).map((s) => (
                                      <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                                        <td style={{ padding: '6px 10px', fontSize: 12, color: 'var(--text-secondary)' }}>
                                          {formatDateTime(s.startedAt)}
                                        </td>
                                        <td style={{ padding: '6px 10px', fontSize: 12, color: 'var(--text-secondary)' }}>
                                          {s.endedAt ? formatDateTime(s.endedAt) : '—'}
                                        </td>
                                        <td style={{ padding: '6px 10px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                                          {s.durationMs ? formatDuration(s.durationMs) : (s.endedAt ? formatDuration(new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) : 'Active')}
                                        </td>
                                        <td style={{ padding: '6px 10px' }}>
                                          <span style={{
                                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                            color: s.endedAt ? '#555' : '#2d7a4f',
                                            background: s.endedAt ? '#f0f0f0' : '#e8f5ee',
                                            textTransform: 'uppercase', letterSpacing: '0.04em',
                                          }}>
                                            {s.endedAt ? 'Ended' : 'Active'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const dateInputStyle: React.CSSProperties = {
  padding: '5px 10px',
  fontSize: 12,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
};
