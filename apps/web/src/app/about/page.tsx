import type { Metadata } from 'next';
import Link from 'next/link';
import '../landing-v2/landing-v2.css';

export const metadata: Metadata = {
  title: 'About — tradeLiv',
  description: 'The team and mission behind tradeLiv — the sourcing platform built for interior designers.',
};

export default function AboutPage() {
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
            <span className="lv2-eyebrow">About</span>
            <h1 className="lv2-section-title">Built by designers,<br />for designers.</h1>
            <p className="lv2-section-sub">
              tradeLiv was founded to solve a problem every interior designer knows: sourcing furniture is broken. We&apos;re building the platform we always wished existed — one that treats designers as professionals, not power users of someone else&apos;s e-commerce stack.
            </p>
          </div>

          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '40px 48px', marginBottom: 32 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.02em' }}>Our mission</h2>
              <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>
                Interior designers spend a disproportionate amount of their time on sourcing logistics — pulling specs from brand websites, building comparison decks, emailing clients PDF attachments, and manually splitting purchase orders across vendors. We believe that time belongs to design, not administration. tradeLiv automates the entire sourcing workflow so designers can focus on the work that actually requires their expertise.
              </p>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '40px 48px', marginBottom: 40 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.02em' }}>The team</h2>
              <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-secondary)', margin: '0 0 24px' }}>
                We&apos;re a small team of designers, engineers, and operators based in the United States. We&apos;re in open beta and building in close collaboration with early-access designers. Full team bios coming soon.
              </p>
              <Link href="/contact" className="lv2-btn-ghost" style={{ display: 'inline-flex' }}>
                Get in touch
              </Link>
            </div>
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
