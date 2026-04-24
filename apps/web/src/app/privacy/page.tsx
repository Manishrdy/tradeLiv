import type { Metadata } from 'next';
import Link from 'next/link';
import '../landing-v2/landing-v2.css';

export const metadata: Metadata = {
  title: 'Privacy Policy — tradeLiv',
  description: 'How tradeLiv collects, uses, and protects your data.',
};

const EFFECTIVE_DATE = 'April 23, 2025';

export default function PrivacyPage() {
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

      <section className="lv2-section">
        <div className="lv2-container">
          <div style={{ maxWidth: 740, margin: '0 auto' }}>
            <span className="lv2-eyebrow">Legal</span>
            <h1 className="lv2-section-title" style={{ textAlign: 'left', margin: '16px 0 8px' }}>Privacy Policy</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 48 }}>Effective date: {EFFECTIVE_DATE}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
              {[
                {
                  title: '1. Information we collect',
                  body: 'When you create an account, we collect your name, email address, and business information. When you use the product, we collect data about projects, rooms, product shortlists, and activity logs necessary to deliver the service. We also collect standard server logs (IP address, browser type, pages visited) for security and performance purposes.',
                },
                {
                  title: '2. How we use your information',
                  body: 'We use your information to provide and improve tradeLiv, to communicate with you about your account, to send product updates and support messages, and to detect and prevent fraud or abuse. We do not sell your personal data to third parties.',
                },
                {
                  title: '3. Data sharing',
                  body: 'We share your data only with service providers who process it on our behalf (e.g., hosting, analytics, email delivery) under strict data-processing agreements. We may disclose your information if required by law or to protect the rights, property, or safety of tradeLiv or its users.',
                },
                {
                  title: '4. Cookies',
                  body: 'tradeLiv uses cookies and similar technologies to maintain your session, remember preferences, and analyze usage. You may disable cookies through your browser settings, but some features of the product may not function correctly without them.',
                },
                {
                  title: '5. Data retention',
                  body: 'We retain your account data for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data at any time by contacting us at support@tradeliv.design.',
                },
                {
                  title: '6. Security',
                  body: 'We use industry-standard security measures including HTTPS encryption, hashed credential storage, and role-based access controls. No method of transmission over the internet is completely secure, and we cannot guarantee absolute security.',
                },
                {
                  title: '7. Children',
                  body: 'tradeLiv is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us immediately.',
                },
                {
                  title: '8. Changes to this policy',
                  body: 'We may update this Privacy Policy from time to time. We will notify you of material changes by email or by posting a notice in the product. Continued use of tradeLiv after the effective date constitutes acceptance of the updated policy.',
                },
                {
                  title: '9. Contact',
                  body: 'For questions about this Privacy Policy, contact us at support@tradeliv.design.',
                },
              ].map((s) => (
                <div key={s.title}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.01em' }}>{s.title}</h2>
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>{s.body}</p>
                </div>
              ))}
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
