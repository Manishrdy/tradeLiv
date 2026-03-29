'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, ChatMessage } from '@/lib/api';

interface Props {
  projectId: string;
  clientName: string;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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

export default function ProjectChatPanel({ projectId, clientName }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [clientOnline, setClientOnline] = useState(false);
  const [clientLastSeen, setClientLastSeen] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const loadMessages = useCallback(async () => {
    const r = await api.getMessages(projectId);
    if (r.data) {
      const msgs = Array.isArray(r.data) ? r.data : r.data.messages ?? [];
      setMessages(msgs);
      setUnread(msgs.filter((m: ChatMessage) => m.senderType === 'client' && !m.readAt).length);
    }
  }, [projectId]);

  const loadPresence = useCallback(async () => {
    const r = await api.getProjectPresence(projectId);
    if (r.data) {
      setClientOnline(r.data.client.online);
      setClientLastSeen(r.data.client.lastSeen);
    }
  }, [projectId]);

  // SSE
  useEffect(() => {
    loadMessages();
    loadPresence();

    const es = new EventSource(`${apiBase}/api/projects/${projectId}/events`, { withCredentials: true });

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
        setMessages((prev) =>
          prev.map((m) =>
            m.senderType === 'designer' && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m,
          ),
        );
      }
    });

    es.addEventListener('presence', (e) => {
      const data = JSON.parse(e.data) as { actorType: string; online: boolean };
      if (data.actorType === 'client') {
        setClientOnline(data.online);
        if (!data.online) setClientLastSeen(new Date().toISOString());
      }
    });

    return () => es.close();
  }, [projectId, apiBase, loadMessages, loadPresence]);

  // Mark read when opened
  useEffect(() => {
    if (open && unread > 0) {
      api.markMessagesRead(projectId, 'designer');
      setUnread(0);
    }
  }, [open, unread, projectId]);

  // Auto-scroll
  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, open]);

  async function handleSend() {
    if (!draft.trim() || sending) return;
    setSending(true);
    const r = await api.sendMessage(projectId, {
      text: draft.trim(),
      senderType: 'designer',
      senderName: '',
    });
    setSending(false);
    if (r.data) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === r.data!.id)) return prev;
        return [...prev, r.data!];
      });
      setDraft('');
    }
  }

  return (
    <>
      {/* FAB Toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 1001,
          width: 56, height: 56, borderRadius: '50%',
          background: open ? '#333' : '#111', border: 'none', color: '#fff',
          cursor: 'pointer',
          boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s, background 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <svg
          width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0)' }}
        >
          {open
            ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
            : <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />}
        </svg>
        {unread > 0 && !open && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            minWidth: 22, height: 22, borderRadius: 11,
            background: '#ef4444', color: '#fff',
            fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2.5px solid #fff', padding: '0 5px',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Chat Card */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 96, right: 28, zIndex: 1000,
          width: 380, height: 520, maxHeight: 'calc(100vh - 140px)',
          borderRadius: 20,
          background: '#fff',
          boxShadow: '0 12px 48px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid rgba(0,0,0,0.06)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'chatPopUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px',
            background: '#111', color: '#fff',
            display: 'flex', alignItems: 'center', gap: 12,
            borderRadius: '20px 20px 0 0',
          }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: '#fff',
              }}>
                {clientName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 11, height: 11, borderRadius: '50%',
                background: clientOnline ? '#22c55e' : '#6b7280',
                border: '2px solid #111',
              }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{clientName}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>
                {clientOnline ? 'Online' : clientLastSeen ? `Last seen ${fmtLastSeen(clientLastSeen)}` : 'Client'}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer',
                color: '#fff', padding: 6, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px 16px 8px',
            display: 'flex', flexDirection: 'column', gap: 6,
            background: '#fafafa',
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#999', fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>&#128172;</div>
                No messages yet.<br />Start a conversation with your client.
              </div>
            )}
            {messages.map((m, idx) => {
              const isDesigner = m.senderType === 'designer';
              const isLast = idx === messages.length - 1;
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isDesigner ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%', padding: '10px 14px', fontSize: 13, lineHeight: 1.5,
                    borderRadius: isDesigner ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: isDesigner ? '#111' : '#fff',
                    color: isDesigner ? '#fff' : '#1a1a1a',
                    boxShadow: isDesigner ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
                    border: isDesigner ? 'none' : '1px solid rgba(0,0,0,0.05)',
                  }}>
                    {!isDesigner && (
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#888', marginBottom: 3 }}>
                        {m.senderName}
                      </div>
                    )}
                    {m.text}
                  </div>
                  <div style={{
                    fontSize: 10, color: '#aaa', marginTop: 3,
                    paddingLeft: 6, paddingRight: 6,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {fmtTime(m.createdAt)}
                    {isDesigner && isLast && (
                      <span style={{ color: m.readAt ? '#3b82f6' : '#ccc', marginLeft: 2, display: 'flex' }}>
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
          <div style={{
            padding: '12px 14px', borderTop: '1px solid rgba(0,0,0,0.06)',
            background: '#fff', display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              placeholder="Type a message\u2026"
              style={{
                flex: 1, border: '1.5px solid #e5e5e5', borderRadius: 24,
                padding: '10px 16px', fontSize: 13, fontFamily: 'inherit',
                outline: 'none', background: '#fafafa',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#111')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e5e5')}
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || sending}
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: draft.trim() ? '#111' : '#e5e5e5',
                border: 'none', cursor: draft.trim() ? 'pointer' : 'default',
                color: draft.trim() ? '#fff' : '#999',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes chatPopUp {
          from { opacity: 0; transform: scale(0.85) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </>
  );
}
