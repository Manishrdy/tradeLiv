'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, QuoteDetail, QuoteUpdatePayload } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function formatPrice(price: number | null | undefined) {
  if (price == null) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(price);
}

function formatDate(d: string | null) {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft:              { bg: 'rgba(0,0,0,0.05)', color: '#555', label: 'Draft' },
  sent:               { bg: 'rgba(50,80,190,0.08)', color: '#3850be', label: 'Sent to Client' },
  approved:           { bg: 'rgba(22,163,74,0.08)', color: '#16a34a', label: 'Approved' },
  revision_requested: { bg: 'rgba(234,179,8,0.10)', color: '#b45309', label: 'Revision Requested' },
  expired:            { bg: 'rgba(0,0,0,0.05)', color: '#888', label: 'Expired' },
  converted:          { bg: 'rgba(22,163,74,0.08)', color: '#16a34a', label: 'Converted' },
};

export default function QuoteDetailPage() {
  const { id: projectId, quoteId } = useParams<{ id: string; quoteId: string }>();
  const router = useRouter();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [converting, setConverting] = useState(false);

  // Fee editing state
  const [feeEditing, setFeeEditing] = useState(false);
  const [feeForm, setFeeForm] = useState({
    taxRate: '',
    commissionType: 'percentage' as 'percentage' | 'fixed',
    commissionValue: '',
    platformFeeType: 'percentage' as 'percentage' | 'fixed',
    platformFeeValue: '',
  });

  const isEditable = quote?.status === 'draft' || quote?.status === 'revision_requested';

  const loadQuote = useCallback(async () => {
    const r = await api.getQuote(quoteId);
    if (!r.error && r.data) {
      setQuote(r.data);
      setFeeForm({
        taxRate: r.data.taxRate?.toString() || '',
        commissionType: r.data.commissionType || 'percentage',
        commissionValue: r.data.commissionValue?.toString() || '',
        platformFeeType: r.data.platformFeeType || 'percentage',
        platformFeeValue: r.data.platformFeeValue?.toString() || '',
      });
    }
    setLoading(false);
  }, [quoteId]);

  useEffect(() => { loadQuote(); }, [loadQuote]);

  // SSE for real-time updates
  useEffect(() => {
    if (!projectId) return;
    const es = new EventSource(`${API_URL}/api/projects/${projectId}/events`, { withCredentials: true });

    es.addEventListener('quote_approved', (e) => {
      const data = JSON.parse(e.data);
      if (data.quoteId === quoteId) loadQuote();
    });

    es.addEventListener('quote_revision_requested', (e) => {
      const data = JSON.parse(e.data);
      if (data.quoteId === quoteId) loadQuote();
    });

    return () => es.close();
  }, [projectId, quoteId, loadQuote]);

  const handleSaveFees = async () => {
    setSaving(true);
    const payload: QuoteUpdatePayload = {
      taxRate: feeForm.taxRate ? parseFloat(feeForm.taxRate) : null,
      commissionType: feeForm.commissionValue ? feeForm.commissionType : null,
      commissionValue: feeForm.commissionValue ? parseFloat(feeForm.commissionValue) : null,
      platformFeeType: feeForm.platformFeeValue ? feeForm.platformFeeType : null,
      platformFeeValue: feeForm.platformFeeValue ? parseFloat(feeForm.platformFeeValue) : null,
    };
    const r = await api.updateQuote(quoteId, payload);
    if (!r.error && r.data) {
      setQuote(r.data);
      setFeeEditing(false);
    }
    setSaving(false);
  };

  const handleUpdateLineItem = async (lineItemId: string, field: 'quantity' | 'adjustmentValue', value: string) => {
    const payload: Record<string, number | null> = {};
    if (field === 'quantity') {
      const n = parseInt(value);
      if (isNaN(n) || n < 1) return;
      payload.quantity = n;
    } else {
      payload.adjustmentValue = value ? parseFloat(value) : null;
    }
    const r = await api.updateQuoteLineItem(quoteId, lineItemId, payload);
    if (!r.error) loadQuote();
  };

  const handleRemoveLineItem = async (lineItemId: string) => {
    if (!confirm('Remove this item from the quote?')) return;
    await api.removeQuoteLineItem(quoteId, lineItemId);
    loadQuote();
  };

  const handleSend = async () => {
    setShowSendConfirm(false);
    setSending(true);
    const r = await api.sendQuote(quoteId);
    if (!r.error) loadQuote();
    else alert(r.error);
    setSending(false);
  };

  const handleConvert = async () => {
    if (!confirm('Convert this approved quote into an order?')) return;
    setConverting(true);
    const r = await api.convertQuoteToOrder(quoteId);
    if (!r.error && r.data) {
      router.push(`/projects/${projectId}/orders/${r.data.id}`);
    } else {
      alert(r.error || 'Failed to convert');
      setConverting(false);
    }
  };

  const handleSaveTitle = async (title: string) => {
    const r = await api.updateQuote(quoteId, { title: title || null });
    if (!r.error && r.data) setQuote(r.data);
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading quote...</div>;
  }

  if (!quote) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Quote not found.</div>;
  }

  const st = STATUS_STYLES[quote.status] || STATUS_STYLES.draft;

  // Group line items by room
  const roomGroups = new Map<string, typeof quote.lineItems>();
  for (const li of quote.lineItems) {
    const roomName = li.room.name;
    if (!roomGroups.has(roomName)) roomGroups.set(roomName, []);
    roomGroups.get(roomName)!.push(li);
  }

  return (
    <div style={{ padding: '24px 40px 80px', maxWidth: 1080 }}>
      {/* Back link */}
      <button
        onClick={() => router.push(`/projects/${projectId}/quotes`)}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16 }}
      >
        &larr; All Quotes
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isEditable ? (
              <input
                defaultValue={quote.title || ''}
                placeholder="Untitled Quote"
                onBlur={(e) => handleSaveTitle(e.target.value)}
                style={{
                  fontSize: 22, fontWeight: 700, border: 'none', borderBottom: '1px dashed var(--border)',
                  background: 'transparent', padding: '0 0 2px', outline: 'none', minWidth: 200,
                }}
              />
            ) : (
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
                {quote.title || `Quote #${quote.id.slice(0, 8)}`}
              </h2>
            )}
            <span style={{
              padding: '4px 12px', fontSize: 12, fontWeight: 600,
              background: st.bg, color: st.color, borderRadius: 99,
            }}>
              {st.label}
            </span>
            {quote.version > 1 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>v{quote.version}</span>}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 16 }}>
            <span>Created {formatDate(quote.createdAt)}</span>
            {quote.sentAt && <span>Sent {formatDate(quote.sentAt)}</span>}
            {quote.approvedAt && <span>Approved {formatDate(quote.approvedAt)}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isEditable && !showSendConfirm && (
            <button
              onClick={() => setShowSendConfirm(true)}
              disabled={sending || quote.lineItems.length === 0}
              style={{
                padding: '10px 20px', fontSize: 13, fontWeight: 600,
                background: '#3850be', color: '#fff', border: 'none', borderRadius: 8,
                cursor: sending ? 'not-allowed' : 'pointer', opacity: (sending || quote.lineItems.length === 0) ? 0.5 : 1,
              }}
            >
              {sending ? 'Sending...' : 'Send to Client'}
            </button>
          )}
          {isEditable && showSendConfirm && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(56,80,190,0.06)', border: '1px solid rgba(56,80,190,0.2)',
              borderRadius: 10, padding: '10px 16px',
            }}>
              <span style={{ fontSize: 13, color: '#1e293b', whiteSpace: 'nowrap' }}>
                Send this quote to the client?
              </span>
              <button
                onClick={handleSend}
                disabled={sending}
                style={{
                  padding: '7px 18px', fontSize: 12.5, fontWeight: 600,
                  background: '#3850be', color: '#fff', border: 'none', borderRadius: 7,
                  cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.5 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {sending ? 'Sending...' : 'Yes, Send'}
              </button>
              <button
                onClick={() => setShowSendConfirm(false)}
                style={{
                  padding: '7px 14px', fontSize: 12.5, fontWeight: 500,
                  background: 'none', border: '1px solid var(--border)', borderRadius: 7,
                  cursor: 'pointer', color: 'var(--text-muted)', whiteSpace: 'nowrap',
                }}
              >
                Cancel
              </button>
            </div>
          )}
          {quote.status === 'approved' && (
            <button
              onClick={handleConvert}
              disabled={converting}
              style={{
                padding: '10px 20px', fontSize: 13, fontWeight: 600,
                background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8,
                cursor: converting ? 'not-allowed' : 'pointer', opacity: converting ? 0.5 : 1,
              }}
            >
              {converting ? 'Converting...' : 'Convert to Order'}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        {/* LEFT: Line Items */}
        <div>
          {/* Fee Configuration */}
          <div style={{
            background: 'var(--bg-surface, #fff)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '18px 22px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Pricing Configuration</h3>
              {isEditable && !feeEditing && (
                <button onClick={() => setFeeEditing(true)} style={{
                  fontSize: 12, color: '#3850be', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600,
                }}>
                  Edit
                </button>
              )}
            </div>

            {feeEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Tax Rate (%)</label>
                    <input
                      type="number" step="0.01" min="0" max="100"
                      value={feeForm.taxRate}
                      onChange={(e) => setFeeForm(p => ({ ...p, taxRate: e.target.value }))}
                      placeholder="e.g. 8.25"
                      style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Design Fee</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <select
                        value={feeForm.commissionType}
                        onChange={(e) => setFeeForm(p => ({ ...p, commissionType: e.target.value as 'percentage' | 'fixed' }))}
                        style={{ padding: '8px 4px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6 }}
                      >
                        <option value="percentage">%</option>
                        <option value="fixed">$</option>
                      </select>
                      <input
                        type="number" step="0.01" min="0"
                        value={feeForm.commissionValue}
                        onChange={(e) => setFeeForm(p => ({ ...p, commissionValue: e.target.value }))}
                        placeholder={feeForm.commissionType === 'percentage' ? 'e.g. 15' : 'e.g. 500'}
                        style={{ flex: 1, padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Platform Fee</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <select
                        value={feeForm.platformFeeType}
                        onChange={(e) => setFeeForm(p => ({ ...p, platformFeeType: e.target.value as 'percentage' | 'fixed' }))}
                        style={{ padding: '8px 4px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6 }}
                      >
                        <option value="percentage">%</option>
                        <option value="fixed">$</option>
                      </select>
                      <input
                        type="number" step="0.01" min="0"
                        value={feeForm.platformFeeValue}
                        onChange={(e) => setFeeForm(p => ({ ...p, platformFeeValue: e.target.value }))}
                        placeholder={feeForm.platformFeeType === 'percentage' ? 'e.g. 5' : 'e.g. 200'}
                        style={{ flex: 1, padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setFeeEditing(false)} style={{
                    padding: '7px 16px', fontSize: 12, background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer',
                  }}>Cancel</button>
                  <button onClick={handleSaveFees} disabled={saving} style={{
                    padding: '7px 16px', fontSize: 12, fontWeight: 600, background: '#0F0F0F', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
                  }}>{saving ? 'Saving...' : 'Save Fees'}</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Tax: </span>
                  <span style={{ fontWeight: 600 }}>{quote.taxRate ? `${quote.taxRate}%` : 'None'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Design Fee: </span>
                  <span style={{ fontWeight: 600 }}>
                    {quote.commissionValue
                      ? quote.commissionType === 'percentage' ? `${quote.commissionValue}%` : formatPrice(quote.commissionValue)
                      : 'None'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Platform Fee: </span>
                  <span style={{ fontWeight: 600 }}>
                    {quote.platformFeeValue
                      ? quote.platformFeeType === 'percentage' ? `${quote.platformFeeValue}%` : formatPrice(quote.platformFeeValue)
                      : 'None'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Line Items by Room */}
          {Array.from(roomGroups.entries()).map(([roomName, items]) => (
            <div key={roomName} style={{
              background: 'var(--bg-surface, #fff)', border: '1px solid var(--border)',
              borderRadius: 10, marginBottom: 16, overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 22px', background: 'rgba(0,0,0,0.02)',
                borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700,
              }}>
                {roomName}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    <th style={{ padding: '10px 22px', textAlign: 'left', fontWeight: 600 }}>Product</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, width: 80 }}>Qty</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, width: 100 }}>Unit Price</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, width: 100 }}>Adjustment</th>
                    <th style={{ padding: '10px 22px', textAlign: 'right', fontWeight: 600, width: 100 }}>Line Total</th>
                    {isEditable && <th style={{ width: 40 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((li) => (
                    <tr key={li.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '14px 22px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {(li.product.imageUrl || li.product.images?.primary) && (
                            <img
                              src={li.product.images?.primary || li.product.imageUrl || ''}
                              alt=""
                              style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)' }}
                            />
                          )}
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{li.product.productName}</div>
                            {li.product.brandName && (
                              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{li.product.brandName}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                        {isEditable ? (
                          <input
                            type="number" min="1" defaultValue={li.quantity}
                            onBlur={(e) => handleUpdateLineItem(li.id, 'quantity', e.target.value)}
                            style={{ width: 50, textAlign: 'right', padding: '4px 6px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 4 }}
                          />
                        ) : (
                          <span style={{ fontSize: 13 }}>{li.quantity}</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: 13 }}>
                        {formatPrice(li.unitPrice)}
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                        {isEditable ? (
                          <input
                            type="number" step="0.01"
                            defaultValue={li.adjustmentValue ?? ''}
                            onBlur={(e) => handleUpdateLineItem(li.id, 'adjustmentValue', e.target.value)}
                            placeholder="0"
                            style={{ width: 70, textAlign: 'right', padding: '4px 6px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 4 }}
                          />
                        ) : (
                          <span style={{ fontSize: 13, color: li.adjustmentValue && li.adjustmentValue !== 0 ? (li.adjustmentValue > 0 ? '#b45309' : '#16a34a') : 'var(--text-muted)' }}>
                            {li.adjustmentValue ? (li.adjustmentValue > 0 ? '+' : '') + formatPrice(li.adjustmentValue) : '--'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 22px', textAlign: 'right', fontSize: 13.5, fontWeight: 600 }}>
                        {formatPrice(li.lineTotal)}
                      </td>
                      {isEditable && (
                        <td style={{ padding: '14px 8px' }}>
                          <button
                            onClick={() => handleRemoveLineItem(li.id)}
                            title="Remove"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                              fontSize: 16, padding: '2px 6px', borderRadius: 4,
                            }}
                          >
                            &times;
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {quote.lineItems.length === 0 && (
            <div style={{
              padding: 40, textAlign: 'center', color: 'var(--text-muted)',
              background: 'var(--bg-surface, #fff)', border: '1px solid var(--border)', borderRadius: 10,
            }}>
              No items in this quote. Add items from your shortlist.
            </div>
          )}
        </div>

        {/* RIGHT: Summary + Comments */}
        <div style={{ position: 'sticky', top: 60 }}>
          {/* Pricing Summary */}
          <div style={{
            background: 'var(--bg-surface, #fff)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '20px 22px', marginBottom: 16,
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                <span style={{ fontWeight: 600 }}>{formatPrice(quote.subtotal)}</span>
              </div>
              {(quote.taxAmount ?? 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Tax ({quote.taxRate}%)</span>
                  <span>{formatPrice(quote.taxAmount)}</span>
                </div>
              )}
              {(quote.commissionAmount ?? 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Design Fee {quote.commissionType === 'percentage' ? `(${quote.commissionValue}%)` : ''}
                  </span>
                  <span>{formatPrice(quote.commissionAmount)}</span>
                </div>
              )}
              {(quote.platformFeeAmount ?? 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Platform Fee {quote.platformFeeType === 'percentage' ? `(${quote.platformFeeValue}%)` : ''}
                  </span>
                  <span>{formatPrice(quote.platformFeeAmount)}</span>
                </div>
              )}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Total</span>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{formatPrice(quote.grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Chat — messages are in the unified project chat panel */}
          <div style={{
            background: 'var(--bg-surface, #fff)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '16px 18px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>
              Messages about this quote appear in the project chat.
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              Use the chat button in the bottom-right corner to discuss this quote with your client.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
