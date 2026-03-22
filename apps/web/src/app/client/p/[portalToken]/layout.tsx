import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your Project — Tradeliv',
  description: 'View your project details, review product selections, and communicate with your designer.',
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Top nav */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(248,247,244,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 20px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.04em', color: '#0F0F0F' }}>
            Tradeliv
          </span>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Client Portal
        </div>
      </header>

      {/* Page content — wider max-width, responsive padding */}
      <main className="portal-main" style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px 80px' }}>
        {children}
      </main>

      {/* Responsive CSS for mobile-first */}
      <style>{`
        @media (max-width: 640px) {
          .portal-main {
            padding: 20px 14px 100px !important;
          }
        }
      `}</style>
    </div>
  );
}
