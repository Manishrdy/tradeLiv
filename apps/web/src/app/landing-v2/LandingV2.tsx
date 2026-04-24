'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import './landing-v2.css';

/* ─── Icons ──────────────────────────────────────────────── */
const Icon = {
  arrow: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  checkGreen: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  sparkles: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"/>
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"/>
    </svg>
  ),
  columns: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="18" rx="1.5" /><rect x="14" y="3" width="7" height="18" rx="1.5" />
    </svg>
  ),
  users: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  package: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  clock: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  link: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  ),
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  spread: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
};

/* ─── Scroll reveal hook ─────────────────────────────────── */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="lv2-reveal" style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ─── Brand data ────────────────────────────────────────── */
const BRANDS = [
  'Crate & Barrel', 'West Elm', 'Restoration Hardware', 'Pottery Barn',
  'CB2', 'Four Hands', 'Arhaus', 'Room & Board',
];

const FAQS = [
  { q: 'Which furniture brands does tradeLiv work with?', a: 'Any brand with a public catalog. tradeLiv\'s AI extracts products from Crate & Barrel, West Elm, Restoration Hardware, Pottery Barn, CB2, Four Hands, Arhaus, Room & Board, and hundreds more. If you have a negotiated trade account, we apply your discount automatically.' },
  { q: 'Do my clients need to create an account?', a: 'No. Clients access their shortlist via a simple link — no signup, no passwords. They can approve items, leave notes, and chat with you directly in the portal.' },
  { q: 'How are trade discounts handled?', a: 'Your negotiated trade rates take priority over default pricing. When a product has multiple discount sources, the best rate wins automatically. You can also override manually on any line item.' },
  { q: 'Can I keep private notes that clients can\'t see?', a: 'Yes. Designer notes are internal-only and never visible in the client portal. Use them for fit assessments, priority rankings, and anything you\'d rather not share.' },
  { q: 'How does consolidated ordering work?', a: 'You place one order in tradeLiv. We route it into brand-specific purchase orders, track each shipment, and surface a unified view to you and your client.' },
  { q: 'Is there a free trial?', a: 'tradeLiv is free during open beta — no credit card required, set up in under 2 minutes. Subscription plans will be announced at launch. Early beta members receive founding-member pricing.' },
];

/* ─── Main ──────────────────────────────────────────────── */
export default function LandingV2() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="lv2-root">
      {/* ── Nav ─────────────────────────────────────────── */}
      <nav className="lv2-nav">
        <div className="lv2-nav-inner">
          <Link href="/" className="lv2-logo" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="lv2-logo-mark">T</span>
            <span>tradeLiv</span>
          </Link>
          <div className="lv2-nav-center">
            <a href="#product">Product</a>
            <a href="#teams">For Teams</a>
            <a href="#integrations">Brands</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="lv2-nav-right">
            <Link href="/login" className="lv2-btn-ghost" style={{ padding: '8px 14px', fontSize: 13 }}>
              Log in
            </Link>
            <Link href="/signup" className="lv2-btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
              Get Started
            </Link>
          </div>
          <button
            className="lv2-mobile-menu-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="13" x2="20" y2="13" /><line x1="4" y1="19" x2="20" y2="19" />
              </svg>
            )}
          </button>
        </div>
        {menuOpen && (
          <div className="lv2-mobile-menu">
            <a href="#product" onClick={() => setMenuOpen(false)}>Product</a>
            <a href="#teams" onClick={() => setMenuOpen(false)}>For Teams</a>
            <a href="#integrations" onClick={() => setMenuOpen(false)}>Brands</a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
            <div className="lv2-mobile-menu-divider" />
            <Link href="/login" onClick={() => setMenuOpen(false)}>Log in</Link>
            <Link href="/signup" className="lv2-mobile-menu-cta" onClick={() => setMenuOpen(false)}>
              Get Started
            </Link>
          </div>
        )}
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="lv2-hero">
        <div className="lv2-hero-bg" />
        <div className="lv2-hero-wave" />
        <div className="lv2-container">
          <div className="lv2-hero-inner">
            <Reveal>
              <span className="lv2-hero-badge">
                <span className="lv2-hero-badge-pill">NEW</span>
                AI extraction now supports 500+ brands
              </span>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="lv2-hero-h1">
                Source furniture across every brand.<br />
                <span className="lv2-hero-gradient-text">One platform. One order.</span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="lv2-hero-sub">
                tradeLiv is the sourcing platform for interior designers. Compare products across brands, collaborate with clients in real time, and place consolidated orders — all from a single dashboard.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="lv2-hero-ctas">
                <Link href="/signup" className="lv2-btn-primary lv2-btn-gold">
                  Start Free {Icon.arrow}
                </Link>
                <a href="#product" className="lv2-btn-ghost">See How It Works</a>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <div className="lv2-hero-trust">
                <span className="lv2-hero-trust-item">{Icon.check} No credit card</span>
                <span className="lv2-hero-trust-item">{Icon.check} Free during beta</span>
                <span className="lv2-hero-trust-item">{Icon.check} 2-minute setup</span>
              </div>
            </Reveal>
          </div>

          {/* Hero preview */}
          <Reveal delay={400}>
            <div className="lv2-hero-preview">
              <div className="lv2-hero-preview-bar">
                <span className="lv2-hero-preview-dot" />
                <span className="lv2-hero-preview-dot" />
                <span className="lv2-hero-preview-dot" />
                <span style={{ marginLeft: 14, fontSize: 12, color: 'var(--text-muted)' }}>
                  app.tradeliv.com / projects / harper-residence / living-room
                </span>
              </div>
              <div className="lv2-hero-preview-body">
                <div className="lv2-hero-preview-side">
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Rooms
                  </div>
                  <div className="lv2-hero-preview-side-item active">
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--gold)' }} />
                    Living Room
                  </div>
                  <div className="lv2-hero-preview-side-item">Primary Bedroom</div>
                  <div className="lv2-hero-preview-side-item">Dining</div>
                  <div className="lv2-hero-preview-side-item">Office</div>
                </div>
                <div className="lv2-hero-preview-cards">
                  {[
                    { img: '/landing/sofa-1.jpg', brand: 'Crate & Barrel', name: 'Arden 3-Seater', price: '$12,450' },
                    { img: '/landing/sofa-2.jpg', brand: 'West Elm', name: 'Oslo Lounge', price: '$9,800' },
                    { img: '/landing/chair.jpg', brand: 'Four Hands', name: 'Nara Accent', price: '$4,200' },
                    { img: '/landing/table.jpg', brand: 'CB2', name: 'Elara Coffee', price: '$3,890' },
                    { img: '/landing/thumb-sofa.jpg', brand: 'Arhaus', name: 'Lennox Sofa', price: '$8,200' },
                    { img: '/landing/thumb-chair.jpg', brand: 'Pottery Barn', name: 'Belford Chair', price: '$2,950' },
                  ].map((p) => (
                    <div key={p.name} className="lv2-hero-preview-card">
                      <div style={{ position: 'relative', height: 120 }}>
                        <Image
                          src={p.img}
                          alt={p.name}
                          fill
                          sizes="(max-width: 760px) 50vw, 200px"
                          style={{ objectFit: 'cover' }}
                        />
                      </div>
                      <div className="lv2-hero-preview-card-meta">
                        <div className="brand">{p.brand}</div>
                        <div className="name">{p.name}</div>
                        <div className="price">{p.price}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lv2-hero-float lv2-hero-float-a">
                <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--green)' }} />
                <span><strong>Client approved</strong> 3 items</span>
              </div>
              <div className="lv2-hero-float lv2-hero-float-b">
                <span style={{ color: 'var(--gold)' }}>{Icon.sparkles}</span>
                <span><strong>42 products</strong> extracted in 8s</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Logo strip ──────────────────────────────────── */}
      <section className="lv2-logo-strip">
        <div className="lv2-container">
          <div className="lv2-logo-strip-label">Sourcing from the brands designers trust</div>
          <div className="lv2-logo-strip-row">
            {['Crate & Barrel', 'West Elm', 'RH', 'Pottery Barn', 'CB2', 'Four Hands', 'Arhaus'].map((b) => (
              <span key={b} className="lv2-logo-strip-item">{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Hub diagram ─────────────────────────────────── */}
      <section className="lv2-section">
        <div className="lv2-container">
          <Reveal>
            <div className="lv2-section-head">
              <span className="lv2-eyebrow">One Platform</span>
              <h2 className="lv2-section-title">Every brand, every workflow, connected.</h2>
              <p className="lv2-section-sub">
                Stop toggling between 12 browser tabs. tradeLiv unifies brand catalogs, client communication, and purchase orders into one source of truth.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="lv2-hub">
              <div className="lv2-hub-center">tradeLiv</div>
              {[
                { cls: 'lv2-hub-n1', label: 'Crate & Barrel' },
                { cls: 'lv2-hub-n2', label: 'West Elm' },
                { cls: 'lv2-hub-n3', label: 'Restoration Hardware' },
                { cls: 'lv2-hub-n4', label: 'Four Hands' },
                { cls: 'lv2-hub-n5', label: 'Arhaus' },
                { cls: 'lv2-hub-n6', label: 'CB2' },
              ].map((n) => (
                <div key={n.cls} className={`lv2-hub-node ${n.cls}`}>
                  <span className="lv2-hub-node-dot" />
                  {n.label}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Product pillars ─────────────────────────────── */}
      <section className="lv2-section" id="product" style={{ paddingTop: 48 }}>
        <div className="lv2-container">

          {/* Pillar 1 — Extraction */}
          <Reveal>
            <div className="lv2-pillar">
              <div className="lv2-pillar-text">
                <span className="lv2-eyebrow">AI Extraction</span>
                <h3>Paste any URL. Get structured data in seconds.</h3>
                <p>
                  Drop a brand URL into tradeLiv. Our AI reads the page, extracts every product listing with prices, dimensions, materials, and images — ready for comparison. No more copy-pasting into spreadsheets.
                </p>
                <ul className="lv2-pillar-bullets">
                  <li>{Icon.check}<span>Works on 500+ furniture and decor brands</span></li>
                  <li>{Icon.check}<span>Extracts finishes, lead times, and trade pricing</span></li>
                  <li>{Icon.check}<span>Batch-imports full collections in under 10 seconds</span></li>
                </ul>
              </div>
              <div className="lv2-pillar-visual">
                <div className="lv2-mock-url">
                  {Icon.link}
                  <span>https://crateandbarrel.com/furniture/sofas</span>
                  <span className="lv2-mock-url-badge">Extract</span>
                </div>
                <div className="lv2-mock-row">
                  <Image src="/landing/thumb-sofa.jpg" alt="Sofa" width={48} height={48} style={{ objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Arden 3-Seater Sofa</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>$12,450 · Oak + Linen · 84×36×32 in</div>
                  </div>
                  {Icon.checkGreen}
                </div>
                <div className="lv2-mock-row">
                  <Image src="/landing/thumb-chair.jpg" alt="Chair" width={48} height={48} style={{ objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Nara Accent Chair</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>$4,200 · Walnut + Velvet · 28×30×33 in</div>
                  </div>
                  {Icon.checkGreen}
                </div>
                <div className="lv2-mock-row">
                  <Image src="/landing/thumb-table.jpg" alt="Table" width={48} height={48} style={{ objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Elara Coffee Table</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>$3,890 · Marble + Brass · 48×24×16 in</div>
                  </div>
                  {Icon.checkGreen}
                </div>
              </div>
            </div>
          </Reveal>

          {/* Pillar 2 — Compare */}
          <Reveal>
            <div className="lv2-pillar reversed">
              <div className="lv2-pillar-text">
                <span className="lv2-eyebrow">Cross-Brand Compare</span>
                <h3>Pin a product. Pull alternatives from anywhere.</h3>
                <p>
                  Compare dimensions, finishes, lead times, and trade pricing side by side. Pin your favorite as a reference and let the rest stack up against it — finally apples to apples.
                </p>
                <ul className="lv2-pillar-bullets">
                  <li>{Icon.check}<span>Visual diff on specs, materials, and delivery</span></li>
                  <li>{Icon.check}<span>One-click swap between pinned alternatives</span></li>
                  <li>{Icon.check}<span>Private designer notes on every comparison</span></li>
                </ul>
              </div>
              <div className="lv2-pillar-visual">
                <div className="lv2-mock-compare">
                  <div className="lv2-mock-compare-card pinned">
                    <span className="lv2-mock-compare-pin">PINNED</span>
                    <div style={{ position: 'relative', height: 110, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
                      <Image src="/landing/sofa-1.jpg" alt="Arden" fill sizes="200px" style={{ objectFit: 'cover' }} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Arden 3-Seater</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Crate & Barrel</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>$12,450</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>84×36×32 · 6–8 wks</div>
                  </div>
                  <div className="lv2-mock-compare-card">
                    <div style={{ position: 'relative', height: 110, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
                      <Image src="/landing/sofa-2.jpg" alt="Oslo" fill sizes="200px" style={{ objectFit: 'cover' }} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Oslo Lounge</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>West Elm</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>$9,800</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>78×34×30 · 4–5 wks</div>
                  </div>
                </div>
                <div style={{ marginTop: 14, padding: 12, background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', borderRadius: 10, fontSize: 12, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{Icon.sparkles}</span>
                  Oslo is $2,650 less and ships 2 weeks sooner.
                </div>
              </div>
            </div>
          </Reveal>

          {/* Pillar 3 — Portal */}
          <Reveal>
            <div className="lv2-pillar">
              <div className="lv2-pillar-text">
                <span className="lv2-eyebrow">Client Portal</span>
                <h3>Share a link. Get approvals inline.</h3>
                <p>
                  Your client opens a simple URL — no login, no password — and sees the shortlisted products in a clean, branded gallery. They approve, reject, and leave notes. Your private design rationale stays hidden.
                </p>
                <ul className="lv2-pillar-bullets">
                  <li>{Icon.check}<span>Zero-friction access for clients</span></li>
                  <li>{Icon.check}<span>Private designer notes stay internal</span></li>
                  <li>{Icon.check}<span>Real-time chat and revision tracking</span></li>
                </ul>
              </div>
              <div className="lv2-pillar-visual">
                <div className="lv2-mock-portal">
                  <div className="lv2-mock-portal-header">
                    {Icon.users}
                    Client Portal — Harper Residence · Living Room
                  </div>
                  <div className="lv2-mock-portal-item">
                    <Image src="/landing/thumb-sofa.jpg" alt="Sofa" width={40} height={40} style={{ objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Arden 3-Seater Sofa</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>$12,450 · Oak + Linen</div>
                    </div>
                    <span className="lv2-mock-portal-pill approved">Approved</span>
                  </div>
                  <div className="lv2-mock-portal-item">
                    <Image src="/landing/thumb-chair.jpg" alt="Chair" width={40} height={40} style={{ objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Nara Accent Chair</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>$4,200 · Walnut + Velvet</div>
                    </div>
                    <span className="lv2-mock-portal-pill pending">Pending</span>
                  </div>
                  <div className="lv2-mock-portal-item">
                    <Image src="/landing/thumb-table.jpg" alt="Table" width={40} height={40} style={{ objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Elara Coffee Table</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>$3,890 · Marble + Brass</div>
                    </div>
                    <span className="lv2-mock-portal-pill approved">Approved</span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

        </div>
      </section>

      {/* ── Problem stack ───────────────────────────────── */}
      <section className="lv2-section" style={{ background: 'var(--bg-card)' }}>
        <div className="lv2-container">
          <Reveal>
            <div className="lv2-section-head">
              <span className="lv2-eyebrow">Why tradeLiv</span>
              <h2 className="lv2-section-title">Designers are done with the old way.</h2>
              <p className="lv2-section-sub">
                Sourcing furniture shouldn&apos;t require 12 tabs, 3 spreadsheets, and a WhatsApp thread per client. We rebuilt the workflow from scratch.
              </p>
            </div>
          </Reveal>
          <div className="lv2-problem-grid">
            <Reveal delay={0}>
              <div className="lv2-problem-card">
                <div className="lv2-problem-icon">{Icon.spread}</div>
                <h4>Kill the spreadsheet</h4>
                <p>Stop maintaining manual product trackers. tradeLiv structures every SKU — specs, pricing, imagery — automatically.</p>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div className="lv2-problem-card">
                <div className="lv2-problem-icon">{Icon.clock}</div>
                <h4>Recover hours per project</h4>
                <p>What took a full afternoon — sourcing, comparing, sending specs — now takes 15 minutes. Spend it on design, not admin.</p>
              </div>
            </Reveal>
            <Reveal delay={160}>
              <div className="lv2-problem-card">
                <div className="lv2-problem-icon">{Icon.shield}</div>
                <h4>Look more professional</h4>
                <p>Clients get a polished, branded experience. No more screenshotted tabs in iMessage. You keep control over what they see.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── For Teams ───────────────────────────────────── */}
      <section className="lv2-section" id="teams">
        <div className="lv2-container">
          <Reveal>
            <div className="lv2-section-head">
              <span className="lv2-eyebrow">For Every Team</span>
              <h2 className="lv2-section-title">From solo practice to full firm.</h2>
              <p className="lv2-section-sub">tradeLiv scales with the way you work — whether you&apos;re a one-person studio or a 30-designer firm.</p>
            </div>
          </Reveal>
          <div className="lv2-teams">
            <Reveal delay={0}>
              <div className="lv2-team-card">
                <span className="lv2-team-tag">Solo</span>
                <h4>Independent Designers</h4>
                <p className="lv2-team-desc">Run your practice out of one dashboard. Keep every client, room, and shortlist organized.</p>
                <ul className="lv2-team-list">
                  <li>{Icon.check}<span>Unlimited projects</span></li>
                  <li>{Icon.check}<span>Client portals</span></li>
                  <li>{Icon.check}<span>AI extraction</span></li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div className="lv2-team-card featured">
                <span className="lv2-team-tag">Studio · Most Popular</span>
                <h4>Small Studios</h4>
                <p className="lv2-team-desc">Collaborate on sourcing across designers. Share shortlists, notes, and brand catalogs across your team.</p>
                <ul className="lv2-team-list">
                  <li>{Icon.check}<span>Team workspaces</span></li>
                  <li>{Icon.check}<span>Trade pricing library</span></li>
                  <li>{Icon.check}<span>Consolidated PO tracking</span></li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={160}>
              <div className="lv2-team-card">
                <span className="lv2-team-tag">Firm</span>
                <h4>Design Firms</h4>
                <p className="lv2-team-desc">Centralize vendor relationships, approvals, and purchasing for large firms with dozens of designers.</p>
                <ul className="lv2-team-list">
                  <li>{Icon.check}<span>Role-based permissions</span></li>
                  <li>{Icon.check}<span>Procurement workflows</span></li>
                  <li>{Icon.check}<span>Dedicated support</span></li>
                </ul>
              </div>
            </Reveal>
          </div>
          <Reveal delay={200}>
            <p style={{ textAlign: 'center', marginTop: 32, fontSize: 14, color: 'var(--text-muted)' }}>
              Free during open beta &mdash; subscription plans announced at launch. Early members receive founding-member pricing.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Golden Path flow ────────────────────────────── */}
      <section className="lv2-section" style={{ background: 'var(--bg-card)' }}>
        <div className="lv2-container">
          <Reveal>
            <div className="lv2-section-head">
              <span className="lv2-eyebrow">The Golden Path</span>
              <h2 className="lv2-section-title">From first sketch to delivered order.</h2>
              <p className="lv2-section-sub">A single workflow across the entire sourcing lifecycle — no handoffs, no lost context.</p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="lv2-flow">
              <div className="lv2-flow-step">
                <span className="lv2-flow-num">01</span>
                <h5>Source</h5>
                <p>Paste URLs or search the catalog. AI structures everything into a room.</p>
              </div>
              <div className="lv2-flow-step">
                <span className="lv2-flow-num">02</span>
                <h5>Shortlist</h5>
                <p>Pin favorites. Add private notes. Compare alternatives across brands.</p>
              </div>
              <div className="lv2-flow-step">
                <span className="lv2-flow-num">03</span>
                <h5>Approve</h5>
                <p>Share a client link. Get approvals, chat, and revisions inline.</p>
              </div>
              <div className="lv2-flow-step">
                <span className="lv2-flow-num">04</span>
                <h5>Order</h5>
                <p>One checkout, one invoice. tradeLiv routes POs to each brand and tracks every shipment.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Integrations grid ───────────────────────────── */}
      <section className="lv2-section" id="integrations">
        <div className="lv2-container">
          <Reveal>
            <div className="lv2-section-head">
              <span className="lv2-eyebrow">Brand Catalog</span>
              <h2 className="lv2-section-title">Every brand at your fingertips.</h2>
              <p className="lv2-section-sub">
                tradeLiv works with any brand with a public website — plus direct integrations and trade pricing for top retailers.
              </p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="lv2-int-grid">
              {BRANDS.map((b) => (
                <div key={b} className="lv2-int-tile">
                  <span className="lv2-int-mark">{b.charAt(0)}</span>
                  <span className="lv2-int-name">{b}</span>
                </div>
              ))}
            </div>
          </Reveal>
          <p style={{ textAlign: 'center', marginTop: 24, color: 'var(--text-muted)', fontSize: 14 }}>
            Plus 500+ more. Don&apos;t see yours? Paste any URL and we&apos;ll extract it.
          </p>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────── */}
      <section className="lv2-section" style={{ background: 'var(--bg-card)' }}>
        <div className="lv2-container">
          <Reveal>
            <div className="lv2-section-head">
              <span className="lv2-eyebrow">What Designers Say</span>
              <h2 className="lv2-section-title">Hours saved. Happier clients.</h2>
            </div>
          </Reveal>
          <div className="lv2-testimonials lv2-testimonials-3">
            <Reveal delay={0}>
              <div className="lv2-quote">
                <div className="lv2-quote-stars">★★★★★</div>
                <div className="lv2-quote-body">
                  &ldquo;I used to spend three hours per room just pulling specs into a comparison deck. With tradeLiv it&apos;s fifteen minutes — and the client portal is a lifesaver.&rdquo;
                </div>
                <div className="lv2-quote-author">
                  <div className="lv2-quote-avatar">MR</div>
                  <div className="lv2-quote-meta">
                    <div className="name">Maya Rodriguez</div>
                    <div className="role">Principal Designer · Rodriguez Studio, Austin</div>
                  </div>
                </div>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div className="lv2-quote">
                <div className="lv2-quote-stars">★★★★★</div>
                <div className="lv2-quote-body">
                  &ldquo;The consolidated ordering alone pays for itself. One invoice, automatic PO splits, and the trade discounts apply without me thinking about it.&rdquo;
                </div>
                <div className="lv2-quote-author">
                  <div className="lv2-quote-avatar">JK</div>
                  <div className="lv2-quote-meta">
                    <div className="name">James Kim</div>
                    <div className="role">Founder · Kim &amp; Co. Interiors, Brooklyn</div>
                  </div>
                </div>
              </div>
            </Reveal>
            <Reveal delay={160}>
              <div className="lv2-quote">
                <div className="lv2-quote-stars">★★★★★</div>
                <div className="lv2-quote-body">
                  &ldquo;We run a six-person studio and tradeLiv finally gave us one shared place for sourcing. No more duplicate research across projects.&rdquo;
                </div>
                <div className="lv2-quote-author">
                  <div className="lv2-quote-avatar">SL</div>
                  <div className="lv2-quote-meta">
                    <div className="name">Sarah Lin</div>
                    <div className="role">Studio Director · Lin &amp; Associates, Chicago</div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Team ────────────────────────────────────────── */}
      <section className="lv2-section">
        <div className="lv2-container">
          <Reveal>
            <div className="lv2-section-head">
              <span className="lv2-eyebrow">The Team</span>
              <h2 className="lv2-section-title">Built by people who&apos;ve felt the pain.</h2>
              <p className="lv2-section-sub">
                tradeLiv was started by designers and operators who spent years stitching together spreadsheets, browser tabs, and email threads just to source a single room. We built the platform we always wished existed.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div style={{ textAlign: 'center' }}>
              <Link href="/about" className="lv2-btn-ghost">
                Meet the team {Icon.arrow}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────── */}
      <section className="lv2-section" id="faq" style={{ background: 'var(--bg-card)' }}>
        <div className="lv2-container">
          <Reveal>
            <div className="lv2-section-head">
              <span className="lv2-eyebrow">FAQ</span>
              <h2 className="lv2-section-title">Questions, answered.</h2>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="lv2-faq">
              {FAQS.map((f, i) => (
                <div key={i} className={`lv2-faq-item ${openFaq === i ? 'open' : ''}`}>
                  <button className="lv2-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    {f.q}
                    <span className="lv2-faq-icon">{Icon.plus}</span>
                  </button>
                  <div className="lv2-faq-a">{f.a}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA banner ──────────────────────────────────── */}
      <section className="lv2-section" style={{ paddingTop: 48 }}>
        <div className="lv2-container">
          <Reveal>
            <div className="lv2-cta-banner">
              <h2>Ready to retire the spreadsheet?</h2>
              <p>Join the designers who&apos;ve made sourcing their favorite part of the project again.</p>
              <div className="lv2-cta-banner-actions">
                <Link href="/signup" className="lv2-btn-primary lv2-btn-gold">
                  Start Free {Icon.arrow}
                </Link>
                <a href="mailto:support@tradeliv.design?subject=tradeLiv%20Demo%20Request" className="lv2-btn-ghost" style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', borderColor: 'rgba(255,255,255,0.15)' }}>
                  Book a Demo
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="lv2-footer">
        <div className="lv2-container">
          <div className="lv2-footer-grid">
            <div className="lv2-footer-brand">
              <div className="lv2-logo">
                <span className="lv2-logo-mark">T</span>
                <span>tradeLiv</span>
              </div>
              <p>The sourcing platform built for interior designers. Source. Shortlist. Ship.</p>
            </div>
            <div className="lv2-footer-col">
              <h6>Product</h6>
              <ul>
                <li><a href="#product">Features</a></li>
                <li><a href="#teams">For Teams</a></li>
                <li><a href="#integrations">Brands</a></li>
                <li><a href="#faq">FAQ</a></li>
              </ul>
            </div>
            <div className="lv2-footer-col">
              <h6>Company</h6>
              <ul>
                <li><a href="/about">About</a></li>
                <li><a href="/contact">Contact</a></li>
                <li><a href="mailto:support@tradeliv.design">Email Us</a></li>
              </ul>
            </div>
            <div className="lv2-footer-col">
              <h6>Legal</h6>
              <ul>
                <li><a href="/privacy">Privacy</a></li>
                <li><a href="/terms">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="lv2-footer-bottom">
            <span>&copy; {new Date().getFullYear()} tradeLiv. All rights reserved.</span>
            <span>Made for designers, in the United States.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
