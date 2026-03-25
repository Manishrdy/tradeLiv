import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

/* ─── SVG Icons (inline, no deps) ─────────────────────────── */

function IconSearch() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconColumns() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="18" rx="1.5" />
      <rect x="14" y="3" width="7" height="18" rx="1.5" />
    </svg>
  );
}

function IconPackage() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

/* ─── Mock UI Cards (illustrative, not real data) ──────────── */

function ProductCardMock({ name, brand, price, dims, delay, image }: {
  name: string; brand: string; price: string; dims: string; delay: string; image: string;
}) {
  return (
    <div className="lp-product-card" style={{ animationDelay: delay }}>
      <div className="lp-product-img">
        <img src={image} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--text-muted)', marginBottom: 2 }}>{brand}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{name}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{price}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dims}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Landing Page ───────────────────────────────────── */

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session');
  const refresh = cookieStore.get('refresh');

  if (session?.value || refresh?.value) {
    redirect('/dashboard');
  }

  return (
    <div className="lp-root">
      {/* ── Navigation ────────────────────────────────────── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-logo">
            <span className="lp-logo-mark">T</span>
            <span className="lp-logo-text">tradeLiv</span>
          </div>
          <div className="lp-nav-links">
            <Link href="/login" className="btn-ghost" style={{ padding: '8px 16px', fontSize: 13 }}>
              Log in
            </Link>
            <Link href="/signup" className="btn-primary" style={{ padding: '8px 18px', fontSize: 13 }}>
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-text">
            <div className="lp-hero-badge">For Interior Designers</div>
            <h1 className="lp-hero-h1">
              Source furniture across brands.
              <br />
              <span style={{ color: 'var(--gold)' }}>One platform, one order.</span>
            </h1>
            <p className="lp-hero-sub">
              Compare products from any brand, collaborate with clients in real-time, and place consolidated orders — all from a single dashboard.
            </p>
            <div className="lp-hero-ctas">
              <Link href="/signup" className="btn-primary" style={{ padding: '12px 28px', fontSize: 15 }}>
                Start Free <IconArrowRight />
              </Link>
              <a href="#how-it-works" className="btn-ghost" style={{ padding: '12px 24px', fontSize: 15 }}>
                See How It Works
              </a>
            </div>
          </div>

          <div className="lp-hero-visual">
            <div className="lp-hero-visual-label">Cross-Brand Comparison</div>
            <div className="lp-hero-cards">
              <ProductCardMock
                name="Arden Sofa Set"
                brand="Crate & Barrel"
                price="$12,450"
                dims="84 × 36 × 32 in"
                delay="0s"
                image="/landing/sofa-1.jpg"
              />
              <ProductCardMock
                name="Oslo Lounge Sofa"
                brand="West Elm"
                price="$9,800"
                dims="78 × 34 × 30 in"
                delay="0.15s"
                image="/landing/sofa-2.jpg"
              />
            </div>
            <div className="lp-hero-pin-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--gold)" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              Pinned for comparison
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem → Solution ────────────────────────────── */}
      <section className="lp-section" id="features">
        <div className="lp-container">
          <div className="lp-section-header">
            <h2 className="lp-section-title">Stop juggling spreadsheets and WhatsApp</h2>
            <p className="lp-section-sub">Three workflows that change how you source furniture.</p>
          </div>
          <div className="lp-solutions-grid">
            <div className="lp-solution-card">
              <div className="lp-solution-icon"><IconSearch /></div>
              <h3 className="lp-solution-title">AI-Powered Extraction</h3>
              <p className="lp-solution-before">Before: Browse 10 brand websites, copy-paste product details into spreadsheets</p>
              <div className="lp-solution-divider" />
              <p className="lp-solution-after">Paste any furniture URL — our AI instantly extracts every product with prices, dimensions, materials, and images into structured data.</p>
            </div>
            <div className="lp-solution-card">
              <div className="lp-solution-icon"><IconColumns /></div>
              <h3 className="lp-solution-title">Cross-Brand Comparison</h3>
              <p className="lp-solution-before">Before: Open tabs side by side, screenshot products, email comparisons to clients</p>
              <div className="lp-solution-divider" />
              <p className="lp-solution-after">Pin a product and compare it against alternatives from any brand — dimensions, finishes, lead times, and trade pricing side by side.</p>
            </div>
            <div className="lp-solution-card">
              <div className="lp-solution-icon"><IconPackage /></div>
              <h3 className="lp-solution-title">One Order, Every Brand</h3>
              <p className="lp-solution-before">Before: Place separate orders with each brand, track 5 different shipments manually</p>
              <div className="lp-solution-divider" />
              <p className="lp-solution-after">Submit one consolidated order. We automatically split it into brand-specific purchase orders and track every delivery for you.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Product Walkthrough ───────────────────────────── */}
      <section className="lp-section lp-section-alt" id="how-it-works">
        <div className="lp-container">
          <div className="lp-section-header">
            <h2 className="lp-section-title">How tradeLiv works</h2>
            <p className="lp-section-sub">From URL to purchase order in four steps.</p>
          </div>

          <div className="lp-steps">
            {/* Step 1 */}
            <div className="lp-step">
              <div className="lp-step-num">01</div>
              <div className="lp-step-content">
                <h3 className="lp-step-title">Paste a URL. Get every product.</h3>
                <p className="lp-step-desc">
                  Drop any furniture brand URL into tradeLiv. Our AI reads the page, extracts every product listing, and structures it — name, price, dimensions, material, images — ready for comparison.
                </p>
                <div className="lp-step-mock">
                  <div className="lp-mock-url-bar">
                    <IconLink />
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>https://crateandbarrel.com/furniture/sofas</span>
                    <span className="lp-mock-extract-btn">Extract</span>
                  </div>
                  <div className="lp-mock-grid">
                    <div className="lp-mock-product-line">
                      <img className="lp-mock-thumb" src="/landing/thumb-sofa.jpg" alt="Sofa" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Arden 3-Seater Sofa</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>$12,450 · Oak + Linen · 84×36×32 in</div>
                      </div>
                    </div>
                    <div className="lp-mock-product-line">
                      <img className="lp-mock-thumb" src="/landing/thumb-chair.jpg" alt="Chair" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Nara Accent Chair</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>$4,200 · Walnut + Velvet · 28×30×33 in</div>
                      </div>
                    </div>
                    <div className="lp-mock-product-line">
                      <img className="lp-mock-thumb" src="/landing/thumb-table.jpg" alt="Coffee Table" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Elara Coffee Table</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>$3,890 · Marble + Brass · 48×24×16 in</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="lp-step">
              <div className="lp-step-num">02</div>
              <div className="lp-step-content">
                <h3 className="lp-step-title">Compare across brands. Pin your pick.</h3>
                <p className="lp-step-desc">
                  Pin a product as your reference, then pull in alternatives from other brands. Compare dimensions, finishes, lead times, and trade pricing — all in one view. No more tab-switching.
                </p>
                <div className="lp-step-mock">
                  <div className="lp-mock-compare">
                    <div className="lp-mock-compare-col lp-mock-compare-pinned">
                      <div className="lp-mock-compare-badge">Pinned</div>
                      <img className="lp-mock-compare-img" src="/landing/sofa-1.jpg" alt="Arden Sofa" />
                      <div style={{ fontWeight: 600, fontSize: 13 }}>Arden 3-Seater</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Crate & Barrel</div>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>$12,450</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>84×36×32 in · 6-8 wks</div>
                    </div>
                    <div className="lp-mock-compare-vs">VS</div>
                    <div className="lp-mock-compare-col">
                      <img className="lp-mock-compare-img" src="/landing/sofa-2.jpg" alt="Oslo Sofa" />
                      <div style={{ fontWeight: 600, fontSize: 13 }}>Oslo Lounge</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>West Elm</div>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>$9,800</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>78×34×30 in · 4-5 wks</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="lp-step">
              <div className="lp-step-num">03</div>
              <div className="lp-step-content">
                <h3 className="lp-step-title">Share with your client. Get approvals inline.</h3>
                <p className="lp-step-desc">
                  Send a portal link — no login required. Your client sees the shortlisted products, approves or rejects items, and leaves notes. Your private design notes stay hidden.
                </p>
                <div className="lp-step-mock">
                  <div className="lp-mock-portal">
                    <div className="lp-mock-portal-header">
                      <IconUsers />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Client Portal — Living Room</span>
                    </div>
                    <div className="lp-mock-portal-item">
                      <img className="lp-mock-thumb" src="/landing/thumb-sofa.jpg" alt="Sofa" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Arden 3-Seater Sofa</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>$12,450 · Oak + Linen</div>
                      </div>
                      <span className="lp-mock-approve-btn">Approved</span>
                    </div>
                    <div className="lp-mock-portal-item">
                      <img className="lp-mock-thumb" src="/landing/thumb-chair.jpg" alt="Chair" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Nara Accent Chair</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>$4,200 · Walnut + Velvet</div>
                      </div>
                      <span className="lp-mock-pending-btn">Pending</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="lp-step">
              <div className="lp-step-num">04</div>
              <div className="lp-step-content">
                <h3 className="lp-step-title">One order. We split it by brand.</h3>
                <p className="lp-step-desc">
                  Add approved items to your cart and check out once. tradeLiv automatically generates separate purchase orders for each brand and tracks fulfillment — you see one unified order.
                </p>
                <div className="lp-step-mock">
                  <div className="lp-mock-order">
                    <div className="lp-mock-order-header">
                      <span style={{ fontSize: 13, fontWeight: 700 }}>Order #FNL-2024-001</span>
                      <span className="lp-mock-status-badge">Paid</span>
                    </div>
                    <div className="lp-mock-po">
                      <div className="lp-mock-po-brand">Crate & Barrel</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>2 items · $16,340</div>
                      <span className="lp-mock-po-status">In Production</span>
                    </div>
                    <div className="lp-mock-po">
                      <div className="lp-mock-po-brand">West Elm</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>1 item · $9,800</div>
                      <span className="lp-mock-po-status">Dispatched</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Built for Designers ───────────────────────────── */}
      <section className="lp-section lp-section-dark">
        <div className="lp-container">
          <div className="lp-dark-inner">
            <h2 className="lp-dark-title">
              Built for designers who are
              <br />
              <span style={{ color: 'var(--gold-light)' }}>done with spreadsheets.</span>
            </h2>
            <div className="lp-dark-features">
              <div className="lp-dark-feature">
                <IconShield />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Your notes stay private</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Designer notes are never visible to clients. Internal reasoning, fit assessments, and priority rankings are for your eyes only.</div>
                </div>
              </div>
              <div className="lp-dark-feature">
                <IconUsers />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>No login for your clients</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Clients access their portal via a simple link — no signup, no passwords. They see products, approve items, and chat with you instantly.</div>
                </div>
              </div>
              <div className="lp-dark-feature">
                <IconLink />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Trade discounts, auto-applied</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Negotiated rates take priority over defaults. The best price wins automatically — no manual calculations.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────── */}
      <section className="lp-section lp-section-cta">
        <div className="lp-container" style={{ textAlign: 'center' }}>
          <h2 className="lp-cta-title">Ready to streamline your sourcing?</h2>
          <p className="lp-cta-sub">Join designers who are saving hours on every project.</p>
          <div className="lp-cta-actions">
            <Link href="/signup" className="btn-primary" style={{ padding: '14px 36px', fontSize: 16 }}>
              Get Started — It&apos;s Free <IconArrowRight />
            </Link>
          </div>
          <div className="lp-cta-checklist">
            <span className="lp-cta-check"><IconCheck /> No credit card required</span>
            <span className="lp-cta-check"><IconCheck /> Free during beta</span>
            <span className="lp-cta-check"><IconCheck /> Set up in 2 minutes</span>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <span className="lp-logo-mark" style={{ width: 28, height: 28, fontSize: 13 }}>F</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>tradeLiv</span>
          </div>
          <div className="lp-footer-links">
            <Link href="/login">Log in</Link>
            <Link href="/signup">Sign up</Link>
          </div>
          <div className="lp-footer-copy">
            &copy; {new Date().getFullYear()} tradeLiv. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
