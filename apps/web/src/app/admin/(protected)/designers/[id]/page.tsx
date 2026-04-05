'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, AdminDesignerDetail } from '@/lib/api';


const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  approved:       { color: '#2d7a4f', bg: '#e8f5ee', label: 'Approved' },
  pending_review: { color: '#7a5c2d', bg: '#fdf5e6', label: 'Pending Review' },
  rejected:       { color: '#8b2635', bg: '#fdecea', label: 'Rejected' },
  suspended:      { color: '#555',    bg: '#f0f0f0', label: 'Suspended' },
};

const REFERRAL_LABELS: Record<string, string> = {
  referral: 'Referral from a colleague',
  google_search: 'Google Search',
  ai_chatbots: 'AI Chatbots / Tools',
  event: 'Trade show or event',
  social_media: 'Social media',
  other: 'Other',
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { color: '#555', bg: '#f0f0f0', label: status };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
      color: s.color, background: s.bg,
      padding: '4px 11px', borderRadius: 20, textTransform: 'uppercase',
    }}>
      {s.label}
    </span>
  );
}

const PROJECT_STATUS_COLOR: Record<string, string> = {
  draft: '#B0ADA8', active: '#2d7a4f', ordered: '#2563eb', closed: '#555',
};

export default function AdminDesignerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [designer, setDesigner] = useState<AdminDesignerDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Simple confirm for approve/suspend
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);

  // Impersonation
  const [impersonating, setImpersonating] = useState(false);

  // Resend confirmation email
  const [showResendModal, setShowResendModal] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');

  // Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.getAdminDesigner(id).then((r) => {
      if (r.error || !r.data) { setNotFound(true); setLoading(false); return; }
      setDesigner(r.data);
      setLoading(false);
    });
  }, [id]);

  async function handleStatusChange(newStatus: string, reason?: string) {
    if (!designer) return;
    setUpdating(true);
    setUpdateError('');
    const r = await api.updateDesignerStatus(id, newStatus, reason);
    setUpdating(false);
    setConfirmStatus(null);
    setShowRejectModal(false);
    setRejectionReason('');
    if (r.error) { setUpdateError(r.error); return; }
    setDesigner((prev) => prev ? { ...prev, status: newStatus, rejectionReason: reason ?? null } : prev);
  }

  async function handleImpersonate() {
    setImpersonating(true);
    const r = await api.impersonateDesigner(id);
    setImpersonating(false);
    if (r.error) { setUpdateError(r.error); return; }
    window.open(r.data.loginUrl, '_blank');
  }

  async function handleResendConfirmation() {
    if (!designer) return;
    setSendingEmail(true);
    setEmailSuccess('');
    const r = await api.adminSendEmail(id, 'verification');
    setSendingEmail(false);
    if (r.error) { setUpdateError(r.error); return; }
    setEmailSuccess(`Confirmation email sent to ${r.data.to}`);
    setTimeout(() => { setShowResendModal(false); setEmailSuccess(''); }, 2000);
  }

  async function handleDelete() {
    setDeleting(true);
    const r = await api.adminDeleteDesigner(id);
    setDeleting(false);
    if (r.error) { setUpdateError(r.error); setShowDeleteModal(false); return; }
    router.replace('/admin/designers');
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

  if (notFound || !designer) {
    return (
      <div style={{ padding: '60px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Designer not found</div>
        <button className="btn-ghost" onClick={() => router.push('/admin/designers')} style={{ fontSize: 13 }}>
          ← Back to Designers
        </button>
      </div>
    );
  }

  const actions: { label: string; action: () => void; style: React.CSSProperties }[] = [
    designer.status !== 'approved'  && { label: 'Approve',  action: () => setConfirmStatus('approved'),  style: { background: '#2d7a4f', color: '#fff', border: 'none' } },
    designer.status !== 'rejected' && designer.status !== 'approved' && { label: 'Reject', action: () => setShowRejectModal(true), style: { background: 'transparent', color: '#8b2635', border: '1px solid rgba(139,38,53,0.3)' } },
    designer.status !== 'suspended' && { label: 'Suspend',  action: () => setConfirmStatus('suspended'), style: { background: 'transparent', color: '#555', border: '1px solid #ccc' } },
  ].filter(Boolean) as { label: string; action: () => void; style: React.CSSProperties }[];

  return (
    <div style={{ padding: '40px 40px 80px', maxWidth: 860 }}>

      {/* Breadcrumb */}
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 20 }}>
        <Link href="/admin/designers" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>
          ← Designers
        </Link>
        <span style={{ margin: '0 6px', color: 'var(--border-strong)' }}>/</span>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{designer.fullName}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em', margin: 0 }}>
              {designer.fullName}
            </h1>
            <StatusBadge status={designer.status} />
            {designer.isAdmin && (
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.07em',
                color: '#7a5c2d', background: '#fdf5e6',
                padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase',
              }}>
                Admin
              </span>
            )}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
            {designer.email}
            {designer.businessName && <span style={{ color: 'var(--border-strong)', margin: '0 6px' }}>·</span>}
            {designer.businessName}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Impersonate */}
          {designer.status === 'approved' && (
            <button
              onClick={handleImpersonate}
              disabled={impersonating}
              title="Open a new tab logged in as this designer (15 min session)"
              style={{
                borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                background: '#f0f4ff', color: '#2d5f7a', border: '1px solid #c3d5e8',
                opacity: impersonating ? 0.6 : 1,
              }}
            >
              {impersonating ? 'Opening…' : 'View as Designer'}
            </button>
          )}
          {/* Resend confirmation — only for users pending verification/review */}
          {(designer.status === 'email_pending' || designer.status === 'pending_review') && (
            <button
              onClick={() => setShowResendModal(true)}
              style={{
                borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)',
              }}
            >
              Resend Confirmation
            </button>
          )}
          {/* Delete — always visible */}
          <button
            onClick={() => setShowDeleteModal(true)}
            style={{
              borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              background: 'transparent', color: '#b91c1c', border: '1px solid rgba(185,28,28,0.3)',
            }}
          >
            Delete
          </button>
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.action}
              disabled={updating}
              style={{
                ...a.style,
                borderRadius: 8, padding: '7px 14px',
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit', opacity: updating ? 0.6 : 1,
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Confirm dialog for approve/suspend */}
      {confirmStatus && (
        <div style={{
          marginBottom: 20, padding: '14px 18px',
          background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border)',
          borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
            Change status to <strong>{STATUS_STYLE[confirmStatus]?.label ?? confirmStatus}</strong>?
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setConfirmStatus(null)}
              style={{
                border: '1px solid var(--border)', borderRadius: 7,
                background: 'transparent', color: 'var(--text-muted)',
                padding: '5px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => handleStatusChange(confirmStatus)}
              disabled={updating}
              style={{
                border: 'none', borderRadius: 7,
                background: '#0F0F0F', color: '#fff',
                padding: '5px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                opacity: updating ? 0.6 : 1,
              }}
            >
              {updating ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {/* Rejection modal */}
      {showRejectModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => { setShowRejectModal(false); setRejectionReason(''); }}>
          <div
            style={{
              background: '#fff', borderRadius: 14, width: 440, padding: '28px 28px 24px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F0F0F', margin: '0 0 6px', letterSpacing: '-0.03em' }}>
              Reject Application
            </h3>
            <p style={{ fontSize: 13, color: '#8C8984', margin: '0 0 20px', lineHeight: 1.5 }}>
              Rejecting <strong style={{ color: '#0F0F0F' }}>{designer.fullName}</strong>.
              Provide a reason so the designer understands why.
            </p>

            <label style={{
              display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em',
              textTransform: 'uppercase', color: '#B0ADA8', marginBottom: 7,
            }}>
              Rejection Reason
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. We couldn't verify your business. Please re-apply with a valid website or LinkedIn profile."
              rows={4}
              style={{
                display: 'block', width: '100%', background: '#FAFAF8',
                border: '1.5px solid #E4E1DC', borderRadius: 10,
                padding: '12px 14px', fontSize: 13.5, color: '#0F0F0F',
                fontFamily: 'inherit', outline: 'none', resize: 'vertical',
                letterSpacing: '-0.01em', transition: 'border-color 0.14s',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#0F0F0F')}
              onBlur={(e) => (e.target.style.borderColor = '#E4E1DC')}
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowRejectModal(false); setRejectionReason(''); }}
                style={{
                  border: '1px solid #E4E1DC', borderRadius: 8,
                  background: 'transparent', color: '#6B6B6B',
                  padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleStatusChange('rejected', rejectionReason || undefined)}
                disabled={updating}
                style={{
                  border: 'none', borderRadius: 8,
                  background: '#8b2635', color: '#fff',
                  padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: updating ? 0.6 : 1,
                }}
              >
                {updating ? 'Rejecting…' : 'Reject Application'}
              </button>
            </div>
          </div>
        </div>
      )}

      {updateError && (
        <div style={{
          marginBottom: 16, padding: '10px 14px',
          background: 'rgba(185,28,28,0.04)', border: '1px solid rgba(185,28,28,0.12)',
          borderRadius: 8, fontSize: 13, color: '#b91c1c',
        }}>
          {updateError}
        </div>
      )}

      {/* Rejection reason banner */}
      {designer.status === 'rejected' && designer.rejectionReason && (
        <div style={{
          marginBottom: 20, padding: '14px 18px',
          background: 'rgba(139,38,53,0.04)', border: '1px solid rgba(139,38,53,0.12)',
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8b2635', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Rejection Reason
          </div>
          <div style={{ fontSize: 13.5, color: '#4a1520', lineHeight: 1.5 }}>
            {designer.rejectionReason}
          </div>
        </div>
      )}

      {/* Info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
            Business Details
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <InfoRow label="Business" value={designer.businessName ?? '—'} />
            <InfoRow label="Phone" value={designer.phone ?? '—'} />
            <InfoRow label="Location" value={designer.city && designer.state ? `${designer.city}, ${designer.state}` : '—'} />
            <InfoRow label="Experience" value={designer.yearsOfExperience ? `${designer.yearsOfExperience} years` : '—'} />
            <InfoRow label="Referral" value={designer.referralSource ? (REFERRAL_LABELS[designer.referralSource] ?? designer.referralSource) : '—'} />
          </div>
        </div>

        <div className="card" style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
            Links & Activity
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {designer.websiteUrl && (
              <InfoRow label="Website" value={designer.websiteUrl} isLink />
            )}
            {designer.linkedinUrl && (
              <InfoRow label="LinkedIn" value={designer.linkedinUrl} isLink />
            )}
            {designer.instagramUrl && (
              <InfoRow label="Instagram" value={designer.instagramUrl} />
            )}
            <InfoRow label="Projects" value={String(designer._count.projects)} />
            <InfoRow label="Clients" value={String(designer._count.clients)} />
            <InfoRow label="Orders" value={String(designer._count.orders)} />
          </div>
        </div>
      </div>

      {/* Account info */}
      <div className="card" style={{ padding: '16px 22px', marginBottom: 20, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <InfoRow label="Member since" value={new Date(designer.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
        <InfoRow label="Last updated" value={new Date(designer.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
        <InfoRow
          label="Last login"
          value={designer.lastLoginAt
            ? new Date(designer.lastLoginAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : 'Never'}
        />
        <InfoRow
          label="Email verified"
          value={designer.status !== 'email_pending' ? 'Yes' : 'No — not verified'}
        />
      </div>

      {/* Recent projects */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Recent Projects
          </div>
        </div>
        {designer.projects.length === 0 ? (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No projects yet
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Project name', 'Client', 'Rooms', 'Status', 'Created'].map((h) => (
                  <th key={h} style={{
                    padding: '9px 16px', textAlign: 'left',
                    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {designer.projects.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '11px 16px', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {p.name}
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {p.client.name}
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                    {p._count.rooms}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                      color: PROJECT_STATUS_COLOR[p.status] ?? '#555',
                      textTransform: 'uppercase',
                    }}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: 12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Resend confirmation modal */}
      {showResendModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setShowResendModal(false); setEmailSuccess(''); }}
        >
          <div
            style={{ background: '#fff', borderRadius: 14, width: 420, padding: '28px 28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0F0F0F', margin: '0 0 6px', letterSpacing: '-0.03em' }}>
              Resend Account Confirmation
            </h3>
            <p style={{ fontSize: 13, color: '#8C8984', margin: '0 0 20px', lineHeight: 1.5 }}>
              A new confirmation email will be sent to{' '}
              <strong style={{ color: '#0F0F0F' }}>{designer.email}</strong> with a fresh verification link valid for 24 hours.
            </p>

            {emailSuccess && (
              <div style={{ marginBottom: 16, padding: '8px 12px', background: '#e8f5ee', borderRadius: 8, fontSize: 12.5, color: '#2d7a4f', fontWeight: 600 }}>
                {emailSuccess}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowResendModal(false); setEmailSuccess(''); }}
                style={{ border: '1px solid #E4E1DC', borderRadius: 8, background: 'transparent', color: '#6B6B6B', padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                onClick={handleResendConfirmation}
                disabled={sendingEmail}
                style={{ border: 'none', borderRadius: 8, background: '#0F0F0F', color: '#fff', padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: sendingEmail ? 0.6 : 1 }}
              >
                {sendingEmail ? 'Sending…' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 14, width: 440, padding: '28px 28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', background: 'rgba(185,28,28,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F0F0F', margin: 0, letterSpacing: '-0.02em' }}>
                  Delete {designer.fullName}?
                </h3>
                <p style={{ fontSize: 13, color: '#8C8984', margin: '3px 0 0', lineHeight: 1.4 }}>
                  This permanently deletes the account and all associated data.
                </p>
              </div>
            </div>

            <div style={{
              background: 'rgba(185,28,28,0.04)', border: '1px solid rgba(185,28,28,0.12)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 20,
              fontSize: 12.5, color: '#7a1a25', lineHeight: 1.5,
            }}>
              All projects, clients, products, orders, quotes, and account data will be permanently erased. This cannot be undone.
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{ border: '1px solid #E4E1DC', borderRadius: 8, background: 'transparent', color: '#6B6B6B', padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ border: 'none', borderRadius: 8, background: '#b91c1c', color: '#fff', padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function InfoRow({ label, value, isLink }: { label: string; value: string; isLink?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 500, flexShrink: 0 }}>{label}</span>
      {isLink ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 13, color: '#2563eb', fontWeight: 600, textAlign: 'right',
            textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220,
          }}
        >
          {value.replace(/^https?:\/\//, '')}
        </a>
      ) : (
        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
      )}
    </div>
  );
}
