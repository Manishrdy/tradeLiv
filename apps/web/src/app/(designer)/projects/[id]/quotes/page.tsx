'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, QuoteSummary, QuoteCreatePayload } from '@/lib/api';

function formatPrice(price: number | null) {
  if (price == null) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price);
}

function formatDate(d: string | null) {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft:              { bg: 'rgba(0,0,0,0.05)', color: '#555', label: 'Draft' },
  sent:               { bg: 'rgba(50,80,190,0.08)', color: '#3850be', label: 'Sent' },
  approved:           { bg: 'rgba(22,163,74,0.08)', color: '#16a34a', label: 'Approved' },
  revision_requested: { bg: 'rgba(234,179,8,0.10)', color: '#b45309', label: 'Revision Requested' },
  expired:            { bg: 'rgba(0,0,0,0.05)', color: '#888', label: 'Expired' },
  converted:          { bg: 'rgba(22,163,74,0.08)', color: '#16a34a', label: 'Converted to Order' },
};

export default function QuotesPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    api.getProjectQuotes(projectId).then((r) => {
      if (!r.error) setQuotes(r.data!);
      setLoading(false);
    });
  }, [projectId]);

  const handleCreate = async () => {
    setCreating(true);
    const payload: QuoteCreatePayload = {};
    const r = await api.createQuote(projectId, payload);
    if (!r.error && r.data) {
      router.push(`/projects/${projectId}/quotes/${r.data.id}`);
    } else {
      alert(r.error || 'Failed to create quote');
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading quotes...
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Quotes</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Create quotes with your fees and send to clients for approval
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          style={{
            padding: '10px 20px', fontSize: 13, fontWeight: 600,
            background: '#0F0F0F', color: '#fff', border: 'none', borderRadius: 8,
            cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.6 : 1,
          }}
        >
          {creating ? 'Creating...' : '+ Create Quote'}
        </button>
      </div>

      {/* Empty state */}
      {quotes.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'var(--bg-surface, #fff)', borderRadius: 12,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>$</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>No quotes yet</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 340, margin: '0 auto 20px' }}>
            Create a quote from your shortlisted items to add pricing, fees, and send it to your client for approval.
          </p>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 600,
              background: '#0F0F0F', color: '#fff', border: 'none', borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Create First Quote
          </button>
        </div>
      )}

      {/* Quote list */}
      {quotes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {quotes.map((q) => {
            const st = STATUS_STYLES[q.status] || STATUS_STYLES.draft;
            const isHovered = hovered === q.id;
            return (
              <div
                key={q.id}
                onClick={() => router.push(`/projects/${projectId}/quotes/${q.id}`)}
                onMouseEnter={() => setHovered(q.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  padding: '18px 22px',
                  background: isHovered ? 'var(--bg-hover, #fafafa)' : 'var(--bg-surface, #fff)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'background 0.15s, box-shadow 0.15s',
                  boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>
                        {q.title || `Quote #${q.id.slice(0, 8)}`}
                      </span>
                      <span style={{
                        padding: '3px 10px', fontSize: 11, fontWeight: 600,
                        background: st.bg, color: st.color, borderRadius: 99,
                      }}>
                        {st.label}
                      </span>
                      {q.version > 1 && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>v{q.version}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12.5, color: 'var(--text-muted)' }}>
                      <span>{q._count.lineItems} item{q._count.lineItems !== 1 ? 's' : ''}</span>
                      <span>Created {formatDate(q.createdAt)}</span>
                      {q.sentAt && <span>Sent {formatDate(q.sentAt)}</span>}
                      {q.approvedAt && <span>Approved {formatDate(q.approvedAt)}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>
                      {formatPrice(q.grandTotal)}
                    </div>
                    {q.subtotal != null && q.grandTotal != null && q.grandTotal !== q.subtotal && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        Subtotal {formatPrice(q.subtotal)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
