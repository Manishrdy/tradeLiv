import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your Project — Furnlo',
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', fontFamily: 'var(--font-body, DM Sans, sans-serif)' }}>
      {/* Top nav */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(250,250,248,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E8E5E0',
        padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.04em', color: '#1A1A1A' }}>
            Furnlo
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#9B9490', fontWeight: 500, letterSpacing: '0.04em' }}>
          CLIENT PORTAL
        </div>
      </header>

      {/* Page content */}
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px' }}>
        {children}
      </main>
    </div>
  );
}
