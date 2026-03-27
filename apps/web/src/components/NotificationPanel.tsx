'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, Notification, NotificationType } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/* ── Helpers ─────────────────────────────────────────── */

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function groupByDate(notifications: Notification[]) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: { label: string; items: Notification[] }[] = [];
  let currentLabel = '';
  let currentItems: Notification[] = [];

  for (const n of notifications) {
    const d = new Date(n.createdAt);
    let label: string;
    if (d.toDateString() === today.toDateString()) label = 'Today';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
    else label = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

    if (label !== currentLabel) {
      if (currentItems.length) groups.push({ label: currentLabel, items: currentItems });
      currentLabel = label;
      currentItems = [n];
    } else {
      currentItems.push(n);
    }
  }
  if (currentItems.length) groups.push({ label: currentLabel, items: currentItems });
  return groups;
}

const ICON_MAP: Record<NotificationType, { color: string; bg: string; icon: React.ReactNode }> = {
  message: {
    color: '#2563eb', bg: 'rgba(37,99,235,0.08)',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  },
  quote_approved: {
    color: '#16a34a', bg: 'rgba(22,163,74,0.08)',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>,
  },
  quote_revision: {
    color: '#ea580c', bg: 'rgba(234,88,12,0.08)',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>,
  },
  quote_comment: {
    color: '#7c3aed', bg: 'rgba(124,58,237,0.08)',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>,
  },
  order_update: {
    color: '#0891b2', bg: 'rgba(8,145,178,0.08)',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>,
  },
  shortlist_change: {
    color: '#d97706', bg: 'rgba(217,119,6,0.08)',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>,
  },
  client_portal_view: {
    color: '#6366f1', bg: 'rgba(99,102,241,0.08)',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  },
  payment_received: {
    color: '#16a34a', bg: 'rgba(22,163,74,0.08)',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  },
};

/* ── Component ───────────────────────────────────────── */

interface Props {
  open: boolean;
  onClose: () => void;
  unreadCount: number;
  onUnreadChange: (count: number) => void;
}

export default function NotificationPanel({ open, onClose, unreadCount, onUnreadChange }: Props) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api.getNotifications({ limit: 50 });
    if (r.data) setNotifications(r.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay to avoid the click that opened the panel
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClick); };
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  async function handleMarkAllRead() {
    setMarkingAll(true);
    await api.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    onUnreadChange(0);
    setMarkingAll(false);
  }

  async function handleClick(n: Notification) {
    // Mark as read
    if (!n.read) {
      api.markNotificationRead(n.id);
      setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, read: true } : item));
      onUnreadChange(Math.max(0, unreadCount - 1));
    }
    // Navigate to resource
    if (n.projectId && n.resourceType === 'quote' && n.resourceId) {
      router.push(`/projects/${n.projectId}/quotes/${n.resourceId}`);
    } else if (n.projectId) {
      router.push(`/projects/${n.projectId}`);
    }
    onClose();
  }

  if (!open) return null;

  const groups = groupByDate(notifications);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      style={{
        position: 'absolute',
        bottom: 56,
        left: 8,
        width: 340,
        maxHeight: 480,
        background: '#fff',
        borderRadius: 14,
        boxShadow: '0 12px 48px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        border: '1px solid #E8E5E0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 100,
        animation: 'notif-slide-up 0.18s ease-out',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #F0EEE9',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0F0F0F', letterSpacing: '-0.02em' }}>
            Notifications
          </span>
          {unreadCount > 0 && (
            <span style={{
              fontSize: 10.5, fontWeight: 700, color: '#fff',
              background: '#ef4444', borderRadius: 10,
              padding: '1px 7px', lineHeight: '17px',
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11.5, fontWeight: 600, color: '#2563eb',
              padding: '2px 6px', borderRadius: 4,
              fontFamily: 'inherit', letterSpacing: '-0.01em',
              opacity: markingAll ? 0.5 : 1,
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '4px 0',
      }}>
        {loading && notifications.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#B0ADA8', fontSize: 13 }}>
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D4D1CC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#8C8984', letterSpacing: '-0.01em' }}>
              No notifications yet
            </div>
            <div style={{ fontSize: 12, color: '#B0ADA8', marginTop: 4 }}>
              You&apos;ll see updates from your clients here
            </div>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <div style={{
                padding: '8px 16px 4px',
                fontSize: 10.5, fontWeight: 700,
                color: '#B0ADA8', textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                {group.label}
              </div>
              {group.items.map((n) => {
                const iconCfg = ICON_MAP[n.type];
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      width: '100%',
                      padding: '10px 16px',
                      border: 'none',
                      background: n.read ? 'transparent' : 'rgba(37,99,235,0.03)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F8F7F5')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(37,99,235,0.03)')}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: iconCfg.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, color: iconCfg.color,
                      marginTop: 1,
                    }}>
                      {iconCfg.icon}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12.5, fontWeight: n.read ? 500 : 650,
                        color: '#0F0F0F', letterSpacing: '-0.01em',
                        lineHeight: '17px',
                      }}>
                        {n.title}
                      </div>
                      {n.body && (
                        <div style={{
                          fontSize: 11.5, color: '#8C8984',
                          marginTop: 2, lineHeight: '15px',
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        }}>
                          {n.body}
                        </div>
                      )}
                      <div style={{
                        fontSize: 10.5, color: '#C8C5BF',
                        marginTop: 3, fontWeight: 500,
                      }}>
                        {timeAgo(n.createdAt)}
                      </div>
                    </div>
                    {/* Unread dot */}
                    {!n.read && (
                      <div style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: '#2563eb', flexShrink: 0,
                        marginTop: 6,
                      }} />
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
