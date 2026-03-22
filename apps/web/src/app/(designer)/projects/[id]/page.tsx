'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ProjectDetail, ProjectUpdatePayload, Address, AuditLogEntry } from '@/lib/api';

/* ─── Helpers ───────────────────────────────────────── */

function formatActivityLabel(action: string): string {
  const MAP: Record<string, string> = {
    project_created:        'Project created',
    project_status_changed: 'Status changed',
    room_created:           'Room added',
    room_deleted:           'Room removed',
    shortlist_item_added:   'Product shortlisted',
    cart_item_added:        'Added to cart',
    order_created:          'Order placed',
  };
  return MAP[action] ?? action.replace(/_/g, ' ');
}

function activityColor(action: string): string {
  if (action.includes('created') || action.includes('added')) return '#2d7a4f';
  if (action.includes('deleted') || action.includes('removed')) return '#b91c1c';
  if (action.includes('status')) return '#2563eb';
  return '#B0ADA8';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatAddress(addr?: Address | null) {
  if (!addr) return null;
  return [addr.line1, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
}

function formatBudget(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

const STATUS_OPTIONS = ['draft', 'active', 'ordered', 'closed'] as const;
const STATUS_STYLES: Record<string, { bg: string; border: string; color: string; dot: string }> = {
  draft:   { bg: 'rgba(0,0,0,0.04)',     border: 'rgba(0,0,0,0.09)',     color: 'var(--text-muted)', dot: '#B0ADA8' },
  active:  { bg: 'var(--green-dim)',      border: 'var(--green-border)',   color: 'var(--green)',      dot: '#2d7a4f' },
  ordered: { bg: 'rgba(37,99,235,0.07)', border: 'rgba(37,99,235,0.18)', color: '#2563eb',           dot: '#2563eb' },
  closed:  { bg: 'rgba(0,0,0,0.04)',     border: 'rgba(0,0,0,0.09)',     color: 'var(--text-muted)', dot: '#555' },
};

const ROOM_ICONS: Record<string, string> = {
  'Living Room': '🛋️', 'Bedroom': '🛏️', 'Kitchen': '🍳', 'Bathroom': '🚿',
  'Dining Room': '🍽️', 'Study': '📚', 'Office': '💼', 'Balcony': '🌿',
};

/* ─── Inline editable field ───────────────────────── */

function InlineField({
  label, value, onSave, type = 'text', multiline = false,
}: {
  label: string; value: string; onSave: (v: string) => void;
  type?: string; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function handleSave() {
    setEditing(false);
    if (draft !== value) onSave(draft);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !multiline) handleSave();
    if (e.key === 'Escape') { setDraft(value); setEditing(false); }
  }

  if (editing) {
    const InputTag = multiline ? 'textarea' : 'input';
    return (
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
        <InputTag
          className="input-field"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          rows={multiline ? 3 : undefined}
          style={multiline ? { resize: 'vertical' } : {}}
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => { setDraft(value); setEditing(true); }}
      style={{ cursor: 'pointer', padding: '4px 0', borderRadius: 6, transition: 'background 0.12s' }}
      title="Click to edit"
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-input)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
        {label}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" style={{ opacity: 0.5 }}>
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </div>
      <div style={{ fontSize: 14, color: value ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 500 }}>
        {value || '—'}
      </div>
    </div>
  );
}

/* ─── Portal link with sharing ─────────────────────── */

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

  function getUrl() {
    return `${window.location.origin}/client/p/${portalToken}`;
  }

  function handleCopy() {
    navigator.clipboard.writeText(getUrl()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleEmail() {
    const url = getUrl();
    const subject = encodeURIComponent('Your project portal is ready');
    const body = encodeURIComponent(`Hi,\n\nYou can view your project details and review product selections here:\n${url}\n\nBest regards`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
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
    <div style={{ display: 'flex', gap: 6 }}>
      <button
        onClick={handleCopy}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          background: copied ? 'rgba(39,103,73,0.1)' : 'var(--bg-input)',
          border: `1px solid ${copied ? 'rgba(39,103,73,0.25)' : 'var(--border-strong)'}`,
          borderRadius: 8, padding: '7px 14px',
          fontSize: 12.5, fontWeight: 700,
          color: copied ? '#276749' : 'var(--text-secondary)',
          cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          {copied
            ? <polyline points="20 6 9 17 4 12" />
            : <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>
          }
        </svg>
        {copied ? 'Copied!' : 'Copy link'}
      </button>
      <button
        onClick={handleEmail}
        title="Send via email"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-input)', border: '1px solid var(--border-strong)',
          borderRadius: 8, padding: '7px 12px',
          cursor: 'pointer', color: 'var(--text-secondary)',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#111'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-input)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      </button>
    </div>
  );
}

/* ─── Activity timeline with filtering ─────────────── */

function ActivitySection({ activity }: { activity: AuditLogEntry[] }) {
  const [filter, setFilter] = useState<string>('all');

  const filters = [
    { label: 'All', value: 'all' },
    { label: 'Status', value: 'status' },
    { label: 'Rooms', value: 'room' },
    { label: 'Items', value: 'item' },
  ];

  const filtered = filter === 'all'
    ? activity
    : activity.filter((e) => e.action.includes(filter));

  if (activity.length === 0) return null;

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Activity</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                border: 'none', borderRadius: 6, padding: '3px 10px',
                fontSize: 11, fontWeight: filter === f.value ? 700 : 500,
                background: filter === f.value ? 'var(--bg-input)' : 'transparent',
                color: filter === f.value ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.12s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
        {/* Connector line */}
        {filtered.length > 1 && (
          <div style={{
            position: 'absolute', left: 7, top: 20, bottom: 20,
            width: 1.5, background: 'var(--border)',
          }} />
        )}
        {filtered.map((entry) => {
          const color = activityColor(entry.action);
          return (
            <div key={entry.id} style={{ display: 'flex', gap: 12, position: 'relative' }}>
              {/* Dot */}
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 3,
                background: '#fff', border: `2px solid ${color}`,
                zIndex: 1,
              }} />
              {/* Content */}
              <div style={{ flex: 1, paddingBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, letterSpacing: '-0.01em' }}>
                  {formatActivityLabel(entry.action)}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  {formatDateTime(entry.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>No matching activity.</div>
        )}
      </div>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────── */

export default function ProjectOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject]   = useState<ProjectDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [activity, setActivity] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    api.getProject(id).then((r) => {
      if (r.data) setProject(r.data);
      setLoading(false);
    });
    api.getProjectActivity(id).then((r) => {
      if (r.data) setActivity(r.data);
    });
  }, [id]);

  /* ── Inline save helper ──────────────────────────── */
  async function saveField(payload: Partial<ProjectUpdatePayload>) {
    if (!project) return;
    setSaving(true); setError('');
    const r = await api.updateProject(id, payload as ProjectUpdatePayload);
    setSaving(false);
    if (r.error) { setError(r.error); return; }
    setProject(r.data!);
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

      {/* ── Project header ───────────────────────────── */}
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
            {/* Status badge with dot */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: st.bg, border: `1px solid ${st.border}`,
              borderRadius: 999, padding: '4px 12px',
              fontSize: 11.5, color: st.color, fontWeight: 700, textTransform: 'capitalize',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot }} />
              {project.status}
            </div>
            {saving && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg className="anim-rotate" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                Saving…
              </span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 5 }}>
            Created {formatDate(project.createdAt)} · Client: <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{project.client.name}</span>
          </div>
        </div>
        {/* Status changer */}
        <div style={{ display: 'flex', gap: 4 }}>
          {STATUS_OPTIONS.map((s) => {
            const sst = STATUS_STYLES[s];
            const isActive = project.status === s;
            return (
              <button
                key={s}
                onClick={() => { if (!isActive) saveField({ status: s }); }}
                style={{
                  border: `1px solid ${isActive ? sst.border : 'var(--border)'}`,
                  background: isActive ? sst.bg : 'transparent',
                  color: isActive ? sst.color : 'var(--text-muted)',
                  borderRadius: 999, padding: '4px 12px',
                  fontSize: 11, fontWeight: 700, cursor: isActive ? 'default' : 'pointer',
                  textTransform: 'capitalize', transition: 'all 0.15s',
                  fontFamily: 'inherit',
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ── Two column layout (responsive) ────────────── */}
      <div className="project-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

        {/* ── Left col ──────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Inline editable project details */}
          <div className="card" style={{ padding: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Project Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <InlineField
                label="Budget"
                value={budget ?? ''}
                onSave={(v) => {
                  // Parse simple budget input
                  const nums = v.replace(/[^0-9,–\-]/g, '').split(/[–\-,]/).map((n) => parseInt(n.replace(/,/g, '')));
                  saveField({
                    budgetMin: nums[0] || null,
                    budgetMax: nums[1] || null,
                  });
                }}
              />
              <InlineField
                label="Style"
                value={project.stylePreference ?? ''}
                onSave={(v) => saveField({ stylePreference: v || null })}
              />
            </div>
            {project.description !== undefined && (
              <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                <InlineField
                  label="Description"
                  value={project.description ?? ''}
                  onSave={(v) => saveField({ description: v || null })}
                  multiline
                />
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Rooms', value: project.rooms.length, href: `/projects/${id}/rooms`, icon: '🛋️' },
              { label: 'Shortlisted', value: project._count.shortlistItems, href: `/projects/${id}/rooms`, icon: '❤️' },
              { label: 'Cart', value: project._count.cartItems, href: `/projects/${id}/cart`, icon: '🛒' },
              { label: 'Orders', value: project._count.orders, href: `/projects/${id}/orders`, icon: '📦' },
            ].map((stat) => (
              <Link key={stat.label} href={stat.href} style={{ textDecoration: 'none' }}>
                <div
                  className="card"
                  style={{ padding: '16px 18px', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.12s, box-shadow 0.12s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{stat.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>{stat.label}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* Room summary — cards with icons and progress */}
          {project.rooms.length > 0 && (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Rooms</div>
                <Link href={`/projects/${id}/rooms`} style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textDecoration: 'none' }}>Manage →</Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {project.rooms.map((room) => {
                  const icon = ROOM_ICONS[room.name] ?? '🏠';
                  return (
                    <Link key={room.id} href={`/projects/${id}/rooms/${room.id}`} style={{ textDecoration: 'none' }}>
                      <div
                        style={{
                          padding: '14px 16px', borderRadius: 10,
                          border: '1px solid var(--border)', background: '#fff',
                          transition: 'all 0.12s', cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-input)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <span style={{ fontSize: 20 }}>{icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                              {room.name}
                            </div>
                            {room.areaSqft && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                                {Number(room.areaSqft).toFixed(0)} sq.ft
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Category needs as mini pills */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {room.categoryNeeds.slice(0, 3).map((cat) => (
                            <span key={cat} style={{
                              fontSize: 10, fontWeight: 600, padding: '2px 8px',
                              borderRadius: 999, background: 'var(--bg-input)',
                              color: 'var(--text-muted)', border: '1px solid var(--border)',
                            }}>
                              {cat}
                            </span>
                          ))}
                          {room.categoryNeeds.length > 3 && (
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '2px 8px',
                              borderRadius: 999, background: 'var(--bg-input)',
                              color: 'var(--text-muted)',
                            }}>
                              +{room.categoryNeeds.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Activity timeline with filtering */}
          <ActivitySection activity={activity} />
        </div>

        {/* ── Right col — Client card ────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>
              Client
            </div>

            {/* Avatar + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: 'var(--bg-input)', border: '1px solid var(--border)',
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

            {/* Portal link with copy + email */}
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
                  Share this link with your client to give them portal access.
                </div>
              )}
            </div>
          </div>

          {/* Add rooms CTA */}
          {project.rooms.length === 0 && (
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
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

      {/* ── Responsive CSS ────────────────────────────── */}
      <style>{`
        @media (max-width: 860px) {
          .project-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
