import type { Metadata } from 'next';
import Link from 'next/link';
import '../landing-v2/landing-v2.css';

export const metadata: Metadata = {
  title: 'Contact — tradeLiv',
  description: 'Get in touch with the tradeLiv team.',
};

export default function ContactPage() {
  return (
    <div className="lv2-root">
      <nav className="lv2-nav">
        <div className="lv2-nav-inner">
          <Link href="/" className="lv2-logo" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="lv2-logo-mark">T</span>
            <span>tradeLiv</span>
          </Link>
          <div className="lv2-nav-right">
            <Link href="/login" className="lv2-btn-ghost" style={{ padding: '8px 14px', fontSize: 13 }}>Log in</Link>
            <Link href="/signup" className="lv2-btn-primary lv2-btn-gold" style={{ padding: '8px 16px', fontSize: 13 }}>Get Started</Link>
          </div>
        </div>
      </nav>

      <section className="lv2-section" style={{ minHeight: '72vh' }}>
        <div className="lv2-container">
          <div className="lv2-section-head">
            <span className="lv2-eyebrow">Contact</span>
            <h1 className="lv2-section-title">We&apos;d love to hear from you.</h1>
            <p className="lv2-section-sub">
              Whether you&apos;re a designer looking to try tradeLiv, a brand interested in partnering, or a journalist covering the space — reach out.
            </p>
          </div>

          <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <a
              href="mailto:support@tradeliv.design"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: '24px 28px',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>General &amp; Support</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>support@tradeliv.design</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </a>

            <a
              href="mailto:support@tradeliv.design?subject=tradeLiv%20Demo%20Request"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: '24px 28px',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>Book a Demo</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Request a walkthrough</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>We&apos;ll schedule a 20-minute call</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      <footer className="lv2-footer">
        <div className="lv2-container">
          <div className="lv2-footer-bottom">
            <span>&copy; {new Date().getFullYear()} tradeLiv. All rights reserved.</span>
            <Link href="/" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}>← Back to home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
