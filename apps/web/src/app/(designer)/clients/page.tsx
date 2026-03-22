'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api, Client } from '@/lib/api';

/* ── Helpers ───────────────────────────────────────── */

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function relativeDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* Generate a stable color from name for avatar */
const AVATAR_COLORS = ['#2d7a4f', '#2563eb', '#9E7C3F', '#7c3aed', '#0891b2', '#be185d', '#b45309', '#4f46e5'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/* ── Duplicate detection ───────────────────────────── */

function findDuplicates(clients: Client[]): Map<string, string[]> {
  const dupes = new Map<string, string[]>();

  // Group by normalized name
  const nameMap = new Map<string, Client[]>();
  clients.forEach((c) => {
    const key = c.name.trim().toLowerCase().replace(/\s+/g, ' ');
    const arr = nameMap.get(key) || [];
    arr.push(c);
    nameMap.set(key, arr);
  });
  nameMap.forEach((group) => {
    if (group.length > 1) {
      group.forEach((c) => {
        const others = group.filter((g) => g.id !== c.id).map((g) => g.name);
        dupes.set(c.id, others);
      });
    }
  });

  // Check email duplicates
  const emailMap = new Map<string, Client[]>();
  clients.forEach((c) => {
    if (!c.email) return;
    const key = c.email.toLowerCase();
    const arr = emailMap.get(key) || [];
    arr.push(c);
    emailMap.set(key, arr);
  });
  emailMap.forEach((group) => {
    if (group.length > 1) {
      group.forEach((c) => {
        if (!dupes.has(c.id)) {
          dupes.set(c.id, group.filter((g) => g.id !== c.id).map((g) => g.name));
        }
      });
    }
  });

  return dupes;
}

/* ══════════════════════════════════════════════════════
   Clients Page
   ══════════════════════════════════════════════════════ */

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getClients().then((r) => {
      if (r.data) setClients(r.data);
      setLoading(false);
    });
  }, []);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search)
  );

  const duplicates = useMemo(() => findDuplicates(clients), [clients]);
  const dupeCount = duplicates.size;

  return (
    <div style={{ padding: '40px 44px', maxWidth: 1100 }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 36, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.035em', marginBottom: 4 }}>
            Clients
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {clients.length > 0 ? `${clients.length} client${clients.length !== 1 ? 's' : ''}` : 'No clients yet'}
          </p>
        </div>
        <Link href="/clients/new" className="btn-primary" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add client
        </Link>
      </div>

      {/* ── Duplicate warning banner ───────────────────── */}
      {dupeCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', marginBottom: 20,
          background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.18)',
          borderRadius: 10, fontSize: 13, color: '#92400e',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            <strong>{dupeCount / 2} potential duplicate{dupeCount > 2 ? 's' : ''}</strong> detected — clients with matching names or emails are highlighted below.
          </span>
        </div>
      )}

      {/* ── Search ─────────────────────────────────────── */}
      {clients.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 28, maxWidth: 340 }}>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="input-field"
            style={{ paddingLeft: 36 }}
            placeholder="Search by name, email, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────── */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13.5, padding: '48px 0' }}>
          <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading clients…
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────── */}
      {!loading && clients.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '80px 20px', gap: 16, textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>No clients yet</div>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 280, lineHeight: 1.6 }}>
              Add your first client to start creating projects and curating products for them.
            </p>
          </div>
          <Link href="/clients/new" className="btn-primary" style={{ textDecoration: 'none', marginTop: 4 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add your first client
          </Link>
        </div>
      )}

      {/* ── No search results ───────────────────────────── */}
      {!loading && clients.length > 0 && filtered.length === 0 && (
        <div style={{ padding: '40px 0', color: 'var(--text-muted)', fontSize: 14 }}>
          No clients match &ldquo;{search}&rdquo;.
        </div>
      )}

      {/* ── Client grid ─────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {filtered.map((client) => {
            const isDupe = duplicates.has(client.id);
            const dupeNames = duplicates.get(client.id);
            const color = avatarColor(client.name);
            const projectCount = client._count?.projects ?? 0;

            return (
              <Link key={client.id} href={`/clients/${client.id}`} style={{ textDecoration: 'none' }}>
                <div
                  className="card"
                  style={{
                    padding: '20px 22px', cursor: 'pointer',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    outline: isDupe ? '2px solid rgba(234,179,8,0.4)' : 'none',
                    outlineOffset: -1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = '';
                    e.currentTarget.style.boxShadow = '';
                  }}
                >
                  {/* Duplicate badge */}
                  {isDupe && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 10, fontWeight: 600, color: '#92400e',
                      background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.18)',
                      borderRadius: 999, padding: '2px 8px', marginBottom: 10,
                      width: 'fit-content',
                    }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      </svg>
                      Possible duplicate of {dupeNames?.[0]}
                    </div>
                  )}

                  {/* Avatar + name row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                      background: `${color}12`,
                      border: `1.5px solid ${color}25`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: color,
                      letterSpacing: '0.02em',
                    }}>
                      {initials(client.name)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {client.name}
                      </div>
                      {client.email && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                          {client.email}
                        </div>
                      )}
                    </div>
                    {/* Last activity indicator */}
                    <div style={{
                      fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500,
                      flexShrink: 0, textAlign: 'right',
                    }}>
                      {relativeDate(client.createdAt)}
                    </div>
                  </div>

                  {/* Meta row — phone + project status summary */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    {client.phone ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12 19.79 19.79 0 0 1 1.97 3.32 2 2 0 0 1 3.94 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.99 5.99l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        {client.phone}
                      </div>
                    ) : (
                      <span />
                    )}
                    {/* Project count with status dot */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: projectCount > 0 ? 'var(--green-dim)' : 'var(--bg-input)',
                      border: `1px solid ${projectCount > 0 ? 'var(--green-border)' : 'var(--border)'}`,
                      borderRadius: 999, padding: '3px 10px', fontSize: 11,
                      color: projectCount > 0 ? 'var(--green)' : 'var(--text-muted)', fontWeight: 600,
                    }}>
                      {projectCount > 0 && (
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)' }} />
                      )}
                      {projectCount} project{projectCount !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Footer — added date */}
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
                    Added {formatDate(client.createdAt)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
