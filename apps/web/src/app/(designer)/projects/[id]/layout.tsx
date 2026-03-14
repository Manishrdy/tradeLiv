'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

const TABS = [
  { label: 'Overview',  href: (id: string) => `/projects/${id}`,          available: true },
  { label: 'Rooms',     href: (id: string) => `/projects/${id}/rooms`,     available: true },
  { label: 'Catalog',   href: (id: string) => `/projects/${id}/catalog`,   available: false },
  { label: 'Shortlist', href: (id: string) => `/projects/${id}/shortlist`, available: false },
  { label: 'Cart',      href: (id: string) => `/projects/${id}/cart`,      available: false },
  { label: 'Orders',    href: (id: string) => `/projects/${id}/orders`,    available: false },
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
          const isActive = pathname === href;
          return tab.available ? (
            <Link
              key={tab.label}
              href={href}
              style={{
                padding: '14px 18px',
                fontSize: 13.5, fontWeight: 700,
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                textDecoration: 'none',
                borderBottom: `2px solid ${isActive ? 'var(--gold)' : 'transparent'}`,
                transition: 'color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)'; }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)'; }}
            >
              {tab.label}
            </Link>
          ) : (
            <span
              key={tab.label}
              style={{
                padding: '14px 18px',
                fontSize: 13.5, fontWeight: 700,
                color: 'var(--border-strong)',
                cursor: 'default', whiteSpace: 'nowrap',
              }}
              title="Coming soon"
            >
              {tab.label}
            </span>
          );
        })}
      </div>

      {children}
    </div>
  );
}
