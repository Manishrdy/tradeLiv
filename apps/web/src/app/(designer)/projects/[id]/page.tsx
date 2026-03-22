'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ProjectDetail, ProjectUpdatePayload, Address, AuditLogEntry } from '@/lib/api';

/* ─── Helpers ───────────────────────────────────────── */

function formatActivityLabel(action: string): string {
  const MAP: Record<string, string> = {
    project_created:        'Project created',
    project_status_changed: 'Project status changed',
    room_created:           'Room added',
    room_deleted:           'Room removed',
  };
  return MAP[action] ?? action.replace(/_/g, ' ');
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatAddress(addr?: Address | null) {
  if (!addr) return null;
  return [addr.line1, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
}

function formatBudget(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (v: number) => {
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1).replace('.0', '')}M`;
    if (v >= 1000)    return `$${(v / 1000).toFixed(0)}K`;
    return `$${v}`;
  };
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

const STATUS_OPTIONS = ['draft', 'active', 'ordered', 'closed'] as const;
const STATUS_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  draft:   { bg: 'rgba(0,0,0,0.04)',     border: 'rgba(0,0,0,0.09)',     color: 'var(--text-muted)' },
  active:  { bg: 'var(--green-dim)',      border: 'var(--green-border)',   color: 'var(--green)' },
  ordered: { bg: 'rgba(50,80,190,0.07)', border: 'rgba(50,80,190,0.18)', color: '#3850be' },
  closed:  { bg: 'rgba(0,0,0,0.04)',     border: 'rgba(0,0,0,0.09)',     color: 'var(--text-muted)' },
};

/* ─── Copy Portal Link ──────────────────────────────── */

function PortalLinkButton({
  projectId, portalToken, onGenerated,
}: {
  projectId: string;
  portalToken: string | null;
  onGenerated: (token: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    const r = await api.generatePortalToken(projectId);
    setGenerating(false);
    if (r.data?.portalToken) onGenerated(r.data.portalToken);
  }

  function handleCopy() {
    const url = `${window.location.origin}/client/p/${portalToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!portalToken) {
    return (
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="btn-ghost"
        style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        {generating ? 'Generating…' : 'Generate Client Link'}
      </button>
    );
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: copied ? 'rgba(39,103,73,0.1)' : 'var(--bg-input)',
        border: `1px solid ${copied ? 'rgba(39,103,73,0.25)' : 'var(--border-strong)'}`,
        borderRadius: 8, padding: '7px 14px',
        fontSize: 12.5, fontWeight: 700,
        color: copied ? '#276749' : 'var(--text-secondary)',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        {copied
          ? <polyline points="20 6 9 17 4 12" />
          : <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>
        }
      </svg>
      {copied ? 'Link Copied!' : 'Copy Client Link'}
    </button>
  );
}

/* ─── Main page ─────────────────────────────────────── */

export default function ProjectOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject]   = useState<ProjectDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [activity, setActivity] = useState<AuditLogEntry[]>([]);

  // Edit form state
  const [editName, setEditName]             = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBudgetMin, setEditBudgetMin]   = useState('');
  const [editBudgetMax, setEditBudgetMax]   = useState('');
  const [editStyle, setEditStyle]           = useState('');
  const [editStatus, setEditStatus]         = useState<string>('draft');

  useEffect(() => {
    api.getProject(id).then((r) => {
      if (r.data) { setProject(r.data); populateEdit(r.data); }
      setLoading(false);
    });
    api.getProjectActivity(id).then((r) => {
      if (r.data) setActivity(r.data);
    });
  }, [id]);

  function populateEdit(p: ProjectDetail) {
    setEditName(p.name);
    setEditDescription(p.description ?? '');
    setEditBudgetMin(p.budgetMin != null ? String(p.budgetMin) : '');
    setEditBudgetMax(p.budgetMax != null ? String(p.budgetMax) : '');
    setEditStyle(p.stylePreference ?? '');
    setEditStatus(p.status);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) { setError('Project name is required.'); return; }
    setSaving(true); setError('');

    const payload: ProjectUpdatePayload = {
      name: editName.trim(),
      description: editDescription.trim() || null,
      budgetMin: editBudgetMin ? Number(editBudgetMin) : null,
      budgetMax: editBudgetMax ? Number(editBudgetMax) : null,
      stylePreference: editStyle.trim() || null,
      status: editStatus as ProjectUpdatePayload['status'],
    };

    const r = await api.updateProject(id, payload);
    setSaving(false);
    if (r.error) { setError(r.error); return; }
    setProject(r.data!);
    populateEdit(r.data!);
    setEditing(false);
  }

  if (loading) {
    return (
      <div style={{ padding: '36px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 14 }}>
          <svg className="anim-rotate" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Loading project…
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: '36px 40px' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Project not found.</div>
        <Link href="/projects" style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>← Back to projects</Link>
      </div>
    );
  }

  const st = STATUS_STYLES[project.status] ?? STATUS_STYLES.draft;
  const budget = formatBudget(project.budgetMin, project.budgetMax);
  const shippingAddr = formatAddress(project.client.shippingAddress as Address | null);

  return (
    <div style={{ padding: '28px 40px', maxWidth: 1100 }}>

      {/* ── Project header ───────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <div>
          <Link href="/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textDecoration: 'none', marginBottom: 10 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Projects
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
              {project.name}
            </h1>
            <div style={{
              background: st.bg, border: `1px solid ${st.border}`,
              borderRadius: 999, padding: '3px 12px',
              fontSize: 11.5, color: st.color, fontWeight: 700, textTransform: 'capitalize',
            }}>
              {project.status}
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 5 }}>
            Created {formatDate(project.createdAt)} · Client: <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{project.client.name}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {!editing && (
            <button className="btn-ghost" onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          )}
        </div>
      </div>

      {/* ── Two column layout ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

        {/* ── Left col ──────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Edit form */}
          {editing ? (
            <div className="card" style={{ padding: 28 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Edit project</div>
              <form onSubmit={handleSave} noValidate>
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Project Name *</label>
                  <input className="input-field" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Description</label>
                  <textarea className="input-field" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} style={{ resize: 'vertical' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                  <div>
                    <label className="form-label">Budget Min ($)</label>
                    <input className="input-field" type="number" value={editBudgetMin} onChange={(e) => setEditBudgetMin(e.target.value)} min="0" />
                  </div>
                  <div>
                    <label className="form-label">Budget Max ($)</label>
                    <input className="input-field" type="number" value={editBudgetMax} onChange={(e) => setEditBudgetMax(e.target.value)} min="0" />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Style Preference</label>
                  <input className="input-field" type="text" value={editStyle} onChange={(e) => setEditStyle(e.target.value)} placeholder="e.g., Modern minimalist" />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label className="form-label">Status</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {STATUS_OPTIONS.map((s) => {
                      const sst = STATUS_STYLES[s];
                      const isActive = editStatus === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setEditStatus(s)}
                          style={{
                            border: `1px solid ${isActive ? sst.border : 'var(--border)'}`,
                            background: isActive ? sst.bg : 'transparent',
                            color: isActive ? sst.color : 'var(--text-muted)',
                            borderRadius: 999, padding: '4px 13px',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            textTransform: 'capitalize', transition: 'all 0.15s',
                          }}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}
                <div style={{ display: 'flex', gap: 10, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? (
                      <><svg className="anim-rotate" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>Saving…</>
                    ) : 'Save changes'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => { setEditing(false); setError(''); populateEdit(project); }}>Cancel</button>
                </div>
              </form>
            </div>
          ) : (
            /* View mode */
            <div className="card" style={{ padding: 28 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Project Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                {[
                  { label: 'Budget', value: budget ?? '—' },
                  { label: 'Style', value: project.stylePreference ?? '—' },
                ].map((row) => (
                  <div key={row.label}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{row.label}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{row.value}</div>
                  </div>
                ))}
              </div>
              {project.description && (
                <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Description</div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{project.description}</div>
                </div>
              )}
            </div>
          )}

          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Rooms', value: project.rooms.length, href: `/projects/${id}/rooms`, icon: '🛋️' },
              { label: 'Shortlisted', value: project._count.shortlistItems, href: `/projects/${id}/rooms`, icon: '❤️' },
              { label: 'Cart', value: project._count.cartItems, href: `/projects/${id}/cart`, icon: '🛒' },
              { label: 'Orders', value: project._count.orders, href: `/projects/${id}/orders`, icon: '📦' },
            ].map((stat) => (
              <div key={stat.label} className="card" style={{ padding: '16px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{stat.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Room summary */}
          {project.rooms.length > 0 && (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Rooms</div>
                <Link href={`/projects/${id}/rooms`} style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textDecoration: 'none' }}>Manage →</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {project.rooms.map((room) => (
                  <Link key={room.id} href={`/projects/${id}/rooms/${room.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--border)', background: 'var(--bg-input)',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#fff'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-input)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{room.name}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {room.categoryNeeds.slice(0, 4).map((cat) => (
                            <span key={cat} className="tag-chip">{cat}</span>
                          ))}
                          {room.categoryNeeds.length > 4 && (
                            <span className="tag-chip">+{room.categoryNeeds.length - 4}</span>
                          )}
                        </div>
                      </div>
                      {room.areaSqft && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, flexShrink: 0 }}>
                          {Number(room.areaSqft).toFixed(0)} sq.ft
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Activity timeline */}
          {activity.length > 0 && (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>Activity</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {activity.map((entry, i) => (
                  <div key={entry.id} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                    {/* Timeline line */}
                    {i < activity.length - 1 && (
                      <div style={{
                        position: 'absolute', left: 6, top: 20, bottom: -4,
                        width: 1, background: 'var(--border)',
                      }} />
                    )}
                    {/* Dot */}
                    <div style={{
                      width: 13, height: 13, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                      background: 'var(--bg-card)', border: '2px solid var(--border-strong)',
                      zIndex: 1,
                    }} />
                    {/* Content */}
                    <div style={{ flex: 1, paddingBottom: 14 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                        {formatActivityLabel(entry.action)}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        {new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right col — Client card ──────────────────── */}
        <div>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>
              Client
            </div>

            {/* Avatar + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)',
              }}>
                {initials(project.client.name)}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 1 }}>{project.client.name}</div>
                <Link href={`/clients/${project.client.id}`} style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none' }}>
                  View client →
                </Link>
              </div>
            </div>

            {/* Contact details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              {project.client.email && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>Email</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{project.client.email}</div>
                </div>
              )}
              {project.client.phone && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>Phone</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{project.client.phone}</div>
                </div>
              )}
              {shippingAddr && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>Shipping Address</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5 }}>{shippingAddr}</div>
                </div>
              )}
            </div>

            {/* Portal link */}
            <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                Client Portal
              </div>
              <PortalLinkButton
                projectId={project.id}
                portalToken={project.portalToken}
                onGenerated={(token) => setProject({ ...project, portalToken: token })}
              />
              {project.portalToken && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
                  Share this link with your client to give them access to the project portal.
                </div>
              )}
            </div>
          </div>

          {/* Add rooms CTA if none yet */}
          {project.rooms.length === 0 && (
            <div className="card" style={{ padding: 20, marginTop: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                No rooms added yet.<br />Add rooms to start building briefs.
              </div>
              <Link href={`/projects/${id}/rooms`} style={{ textDecoration: 'none' }}>
                <button className="btn-ghost" style={{ fontSize: 12 }}>
                  + Add Rooms
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
