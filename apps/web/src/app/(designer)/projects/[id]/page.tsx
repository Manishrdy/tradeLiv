'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ProjectDetail, ProjectUpdatePayload, Address, AuditLogEntry, ChatMessage } from '@/lib/api';

/* ─── Image compression ────────────────────────────── */

const MAX_IMAGE_KB = 200;
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

function compressImage(file: File, maxKB: number): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Scale down if needed (max 1200px on longest side)
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        // Iteratively reduce quality until under maxKB
        let quality = 0.85;
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        let dataUrl = canvas.toDataURL(outputType, quality);

        while (dataUrl.length * 0.75 > maxKB * 1024 && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        const base64 = dataUrl.split(',')[1];
        const finalMime = quality < 0.85 && file.type === 'image/png' ? 'image/jpeg' : outputType;
        resolve({ base64, mimeType: finalMime });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/* ─── Project Image Upload Component ──────────────── */

function ProjectImageUpload({
  projectId, imageUrl, imageDataUri, onUpdated,
}: {
  projectId: string;
  imageUrl: string | null;
  imageDataUri: string | null;
  onUpdated: (project: ProjectDetail) => void;
}) {
  const [mode, setMode] = useState<'display' | 'url'>('display');
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const currentImage = imageDataUri || imageUrl || null;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Only JPEG/JPG/PNG images are allowed.');
      return;
    }

    setError('');
    setUploading(true);
    try {
      const { base64, mimeType } = await compressImage(file, MAX_IMAGE_KB);
      const r = await api.uploadProjectImage(projectId, base64, mimeType);
      if (r.error) { setError(r.error); }
      else { onUpdated(r.data!); }
    } catch {
      setError('Failed to compress/upload image.');
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleUrlSubmit() {
    if (!urlInput.trim()) return;
    setError('');
    setUploading(true);
    const r = await api.setProjectImageUrl(projectId, urlInput.trim());
    setUploading(false);
    if (r.error) { setError(r.error); }
    else { onUpdated(r.data!); setUrlInput(''); setMode('display'); }
  }

  async function handleRemove() {
    setUploading(true);
    const r = await api.deleteProjectImage(projectId);
    setUploading(false);
    if (r.error) setError(r.error);
    else onUpdated(r.data!);
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Image display / upload area */}
      {currentImage ? (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#f5f4f2' }}>
          <img
            src={currentImage}
            alt="Project"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          {/* Overlay controls */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '24px 16px 12px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.5))',
            display: 'flex', gap: 6, justifyContent: 'flex-end',
          }}>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: 6,
                padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                color: '#333', backdropFilter: 'blur(4px)',
              }}
            >
              Replace
            </button>
            <button
              onClick={() => { setUrlInput(''); setMode('url'); }}
              style={{
                background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: 6,
                padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                color: '#333', backdropFilter: 'blur(4px)',
              }}
            >
              URL
            </button>
            <button
              onClick={handleRemove}
              disabled={uploading}
              style={{
                background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: 6,
                padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                color: '#fff', backdropFilter: 'blur(4px)',
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            width: '100%', aspectRatio: '16/9', background: '#fafaf9',
            border: '2px dashed var(--border)', borderRadius: 12,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = '#f5f4f2'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = '#fafaf9'; }}
        >
          {uploading ? (
            <svg className="anim-rotate" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          ) : (
            <>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8, opacity: 0.6 }}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>
                Click to upload image
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, opacity: 0.7 }}>
                JPEG, PNG · auto-compressed to &lt;200KB
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setMode('url'); }}
                style={{
                  marginTop: 8, background: 'none', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600,
                  color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Or paste URL
              </button>
            </>
          )}
        </div>
      )}

      {/* URL input mode */}
      {mode === 'url' && (
        <div style={{ padding: '12px 16px', borderTop: currentImage ? '1px solid var(--border)' : 'none', display: 'flex', gap: 8 }}>
          <input
            className="input-field"
            type="url"
            placeholder="Paste image URL…"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit(); if (e.key === 'Escape') setMode('display'); }}
            autoFocus
            style={{ flex: 1, fontSize: 12 }}
          />
          <button
            onClick={handleUrlSubmit}
            disabled={!urlInput.trim() || uploading}
            style={{
              background: '#111', color: '#fff', border: 'none', borderRadius: 8,
              padding: '6px 14px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', opacity: urlInput.trim() ? 1 : 0.4,
            }}
          >
            Save
          </button>
          <button
            onClick={() => setMode('display')}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 8,
              padding: '6px 10px', fontSize: 11.5, cursor: 'pointer', color: 'var(--text-muted)',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div style={{ padding: '8px 16px 12px', fontSize: 11.5, color: '#ef4444', fontWeight: 500 }}>
          {error}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".jpg,.jpeg,.png"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}

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

/* ── Designer Chat Widget ──────────────────────────── */

function DesignerChatWidget({ projectId, clientName }: { projectId: string; clientName: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [clientOnline, setClientOnline] = useState(false);
  const [clientLastSeen, setClientLastSeen] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const loadMessages = useCallback(async () => {
    const r = await api.getMessages(projectId);
    if (r.data) {
      setMessages(r.data);
      const unreadCount = r.data.filter((m) => m.senderType === 'client' && !m.readAt).length;
      setUnread(unreadCount);
    }
  }, [projectId]);

  const loadPresence = useCallback(async () => {
    const r = await api.getProjectPresence(projectId);
    if (r.data) {
      setClientOnline(r.data.client.online);
      setClientLastSeen(r.data.client.lastSeen);
    }
  }, [projectId]);

  // SSE for real-time updates
  useEffect(() => {
    loadMessages();
    loadPresence();

    const es = new EventSource(`${apiBase}/api/projects/${projectId}/events`, { withCredentials: true });
    sseRef.current = es;

    es.addEventListener('new_message', (e) => {
      const msg = JSON.parse(e.data) as ChatMessage;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (msg.senderType === 'client') setUnread((prev) => prev + 1);
    });

    es.addEventListener('messages_read', (e) => {
      const data = JSON.parse(e.data) as { readerType: string };
      if (data.readerType === 'client') {
        setMessages((prev) => prev.map((m) =>
          m.senderType === 'designer' && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m
        ));
      }
    });

    es.addEventListener('presence', (e) => {
      const data = JSON.parse(e.data) as { actorType: string; online: boolean };
      if (data.actorType === 'client') {
        setClientOnline(data.online);
        if (!data.online) setClientLastSeen(new Date().toISOString());
      }
    });

    return () => { es.close(); };
  }, [projectId, apiBase, loadMessages, loadPresence]);

  useEffect(() => {
    if (open && unread > 0) {
      api.markMessagesRead(projectId, 'designer');
      setUnread(0);
    }
  }, [open, unread, projectId]);

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, open]);

  async function handleSend() {
    if (!draft.trim() || sending) return;
    setSending(true);
    const r = await api.sendMessage(projectId, { text: draft.trim(), senderType: 'designer', senderName: '' });
    setSending(false);
    if (r.data) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === r.data!.id)) return prev;
        return [...prev, r.data!];
      });
      setDraft('');
    }
  }

  function fmtLastSeen(iso: string | null) {
    if (!iso) return '';
    const d = new Date(iso);
    const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 100,
          width: 52, height: 52, borderRadius: '50%',
          background: '#111', border: 'none', color: '#fff',
          cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {unread > 0 && !open && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            width: 20, height: 20, borderRadius: '50%',
            background: '#ef4444', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff',
          }}>
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="anim-scale-in" style={{
          position: 'fixed', bottom: 88, right: 24, zIndex: 100,
          width: 360, maxHeight: 480, borderRadius: 16,
          background: '#fff', boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          border: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-input)',
                border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
              }}>
                {clientName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span style={{
                position: 'absolute', bottom: -1, right: -1,
                width: 10, height: 10, borderRadius: '50%',
                background: clientOnline ? '#22c55e' : '#9ca3af',
                border: '2px solid #fff',
              }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{clientName}</div>
              <div style={{ fontSize: 10.5, color: clientOnline ? '#22c55e' : 'var(--text-muted)' }}>
                {clientOnline ? 'Online' : clientLastSeen ? `Last seen ${fmtLastSeen(clientLastSeen)}` : 'Client'}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200, maxHeight: 320 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 12.5 }}>
                No messages yet. Start a conversation with your client.
              </div>
            )}
            {messages.map((m, idx) => {
              const isDesigner = m.senderType === 'designer';
              const isLast = idx === messages.length - 1;
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isDesigner ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%', padding: '9px 13px', borderRadius: 12,
                    background: isDesigner ? '#111' : 'var(--bg-input)',
                    color: isDesigner ? '#fff' : 'var(--text-primary)',
                    fontSize: 13, lineHeight: 1.45,
                    borderBottomRightRadius: isDesigner ? 4 : 12,
                    borderBottomLeftRadius: isDesigner ? 12 : 4,
                  }}>
                    {m.text}
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 3, paddingLeft: 4, paddingRight: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {new Date(m.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    {isDesigner && isLast && (
                      <span style={{ color: m.readAt ? '#2563eb' : 'var(--text-muted)', marginLeft: 2 }}>
                        {m.readAt ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12l5 5L18 6" /><path d="M7 12l5 5L23 6" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12l5 5L20 7" />
                          </svg>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              placeholder="Type a message…"
              style={{
                flex: 1, border: '1px solid var(--border)', borderRadius: 8,
                padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
                outline: 'none', background: 'var(--bg-input)',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || sending}
              style={{
                width: 36, height: 36, borderRadius: 8,
                background: draft.trim() ? '#111' : 'var(--bg-input)',
                border: 'none', cursor: draft.trim() ? 'pointer' : 'default',
                color: draft.trim() ? '#fff' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.12s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
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

/* ─── PDF Download Button ──────────────────────────── */

function PdfDownloadButton({ projectId }: { projectId: string }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    const result = await api.downloadProjectPdf(projectId);
    setDownloading(false);
    if (result.error) { alert(result.error); return; }
    if (result.data) {
      const url = URL.createObjectURL(result.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Project_Proposal.pdf';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        border: '1px solid var(--border)', background: 'var(--bg-card)',
        color: 'var(--text-secondary)', borderRadius: 999, padding: '5px 14px',
        fontSize: 11.5, fontWeight: 700, cursor: downloading ? 'wait' : 'pointer',
        fontFamily: 'inherit', transition: 'all 0.15s', opacity: downloading ? 0.6 : 1,
      }}
      title="Download project proposal as PDF"
    >
      {downloading ? (
        <svg className="anim-rotate" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
      )}
      PDF Proposal
    </button>
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
        {/* Status changer + PDF */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
          <PdfDownloadButton projectId={id} />
        </div>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ── Two column layout (responsive) ────────────── */}
      <div className="project-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

        {/* ── Left col ──────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Project image */}
          <ProjectImageUpload
            projectId={project.id}
            imageUrl={project.imageUrl}
            imageDataUri={project.imageDataUri}
            onUpdated={(p) => setProject(p)}
          />

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

      {/* ── Chat with client ───────────────────────────── */}
      <DesignerChatWidget projectId={project.id} clientName={project.client.name} />

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
