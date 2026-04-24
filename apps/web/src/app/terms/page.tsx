import type { Metadata } from 'next';
import Link from 'next/link';
import '../landing-v2/landing-v2.css';

export const metadata: Metadata = {
  title: 'Terms of Service — tradeLiv',
  description: 'Terms and conditions for using tradeLiv.',
};

const EFFECTIVE_DATE = 'April 23, 2025';

export default function TermsPage() {
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
            <h1 className="lv2-section-title" style={{ textAlign: 'left', margin: '16px 0 8px' }}>Terms of Service</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 48 }}>Effective date: {EFFECTIVE_DATE}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
              {[
                {
                  title: '1. Acceptance of terms',
                  body: 'By creating an account or using tradeLiv ("the Service"), you agree to these Terms of Service. If you do not agree, you may not use the Service. These terms apply to all users, including designers, firm administrators, and clients accessing shared portals.',
                },
                {
                  title: '2. Beta service',
                  body: 'tradeLiv is currently offered as a beta product. The Service is provided "as is" and may be subject to change, interruption, or discontinuation without notice. We appreciate your feedback during the beta period and commit to communicating major changes by email.',
                },
                {
                  title: '3. Your account',
                  body: 'You are responsible for maintaining the security of your account credentials. You must provide accurate information when creating your account. You may not share your account with third parties or use the Service for unlawful purposes.',
                },
                {
                  title: '4. Acceptable use',
                  body: 'You agree not to: (a) scrape, reverse-engineer, or copy the Service or its underlying technology; (b) use the Service to send spam or unsolicited communications; (c) upload malicious code or attempt to compromise the security of the Service; or (d) use the Service to infringe any third-party intellectual property rights.',
                },
                {
                  title: '5. Your content',
                  body: 'You retain ownership of all content you upload or create in tradeLiv (projects, notes, client data). You grant tradeLiv a limited license to store and process this content solely to provide the Service. You represent that you have the right to submit this content and that it does not violate any third-party rights.',
                },
                {
                  title: '6. Third-party brand data',
                  body: 'tradeLiv\'s AI extraction features retrieve publicly available product information from third-party brand websites. tradeLiv does not claim ownership of this content and is not responsible for its accuracy. Pricing, availability, and specifications sourced from third-party sites may change without notice.',
                },
                {
                  title: '7. Fees and billing',
                  body: 'tradeLiv is currently free during the open beta period. We will provide reasonable advance notice before introducing paid plans. Continued use after pricing is introduced constitutes acceptance of the applicable fees.',
                },
                {
                  title: '8. Disclaimers and limitation of liability',
                  body: 'The Service is provided without warranty of any kind, express or implied. To the maximum extent permitted by law, tradeLiv shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service, even if we have been advised of the possibility of such damages.',
                },
                {
                  title: '9. Termination',
                  body: 'Either party may terminate this agreement at any time. We reserve the right to suspend or terminate accounts that violate these Terms. Upon termination, your right to use the Service ceases immediately.',
                },
                {
                  title: '10. Governing law',
                  body: 'These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles.',
                },
                {
                  title: '11. Changes',
                  body: 'We may update these Terms from time to time. We will notify you of material changes by email or in-product notice. Your continued use after the effective date of changes constitutes acceptance.',
                },
                {
                  title: '12. Contact',
                  body: 'Questions about these Terms? Contact us at support@tradeliv.design.',
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
