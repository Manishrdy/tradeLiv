'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

const TABS = [
  { label: 'Overview', href: (id: string) => `/projects/${id}` },
  { label: 'Rooms',    href: (id: string) => `/projects/${id}/rooms` },
];

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();

  return (
    <div>
      {/* Sub-nav tab bar */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 40px',
        display: 'flex', alignItems: 'center', gap: 0,
        background: 'var(--bg-surface, #fff)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        {TABS.map((tab) => {
          const href = tab.href(id);
          const isActive = pathname === href || (tab.label === 'Rooms' && pathname.startsWith(`/projects/${id}/rooms`));
          return (
            <Link
              key={tab.label}
              href={href}
              style={{
                padding: '14px 18px',
                fontSize: 13.5, fontWeight: 700,
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                textDecoration: 'none',
                borderBottom: `2px solid ${isActive ? '#0F0F0F' : 'transparent'}`,
                transition: 'color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)'; }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)'; }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
