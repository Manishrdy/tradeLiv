import Link from '@/components/Link';

export default function NotFound() {
  return (
    <div
      className="bg-dot-grid"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-base)',
        padding: '40px 20px',
      }}
    >
      {/* Ambient blobs */}
      <div className="fixed pointer-events-none anim-float-a" style={{ width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(196,148,40,0.09) 0%, transparent 65%)', top: -160, left: -120, zIndex: 0 }} />
      <div className="fixed pointer-events-none anim-float-b" style={{ width: 440, height: 440, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(180,90,40,0.06) 0%, transparent 65%)', bottom: -120, right: -100, zIndex: 0 }} />

      <div className="card anim-scale-in" style={{ padding: '52px 48px', maxWidth: 440, width: '100%', textAlign: 'center', position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 40 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'linear-gradient(145deg, #c98e1a 0%, #a8710a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(168,113,10,0.25)',
          }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M2 3.5h12M2 8h7M2 12.5h9" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>tradeliv</span>
        </div>

        {/* 404 numeral */}
        <div style={{
          fontSize: 80,
          fontWeight: 900,
          letterSpacing: '-0.05em',
          lineHeight: 1,
          marginBottom: 4,
          backgroundImage: 'linear-gradient(135deg, #c8a028 0%, #a8710a 50%, #c8a028 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          404
        </div>

        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>
          Page not found
        </div>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 36 }}>
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link href="/dashboard" className="btn-primary" style={{ textDecoration: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
            Go to dashboard
          </Link>
          <Link href="/login" className="btn-ghost" style={{ textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>

      </div>
    </div>
  );
}
