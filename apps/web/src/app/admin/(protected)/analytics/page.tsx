'use client';

import { useEffect, useState } from 'react';
import { api, RevenueAnalytics, ProductAnalytics, ClientAnalytics } from '@/lib/api';

type Tab = 'revenue' | 'products' | 'clients';

const SHORTLIST_STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  suggested:     { color: '#2d5f7a', bg: '#e6f0fd', label: 'Suggested' },
  approved:      { color: '#2d7a4f', bg: '#e8f5ee', label: 'Approved' },
  rejected:      { color: '#8b2635', bg: '#fdecea', label: 'Rejected' },
  added_to_cart: { color: '#7a5c2d', bg: '#fdf5e6', label: 'In Cart' },
  ordered:       { color: '#555',    bg: '#f0f0f0', label: 'Ordered' },
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminAnalyticsPage() {
  const [tab, setTab] = useState<Tab>('revenue');
  const [revenue, setRevenue] = useState<RevenueAnalytics | null>(null);
  const [products, setProducts] = useState<ProductAnalytics | null>(null);
  const [clients, setClients] = useState<ClientAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getAdminRevenueAnalytics({ months: 12 }),
      api.getAdminProductAnalytics(),
      api.getAdminClientAnalytics(),
    ]).then(([rRes, pRes, cRes]) => {
      if (rRes.data) setRevenue(rRes.data);
      if (pRes.data) setProducts(pRes.data);
      if (cRes.data) setClients(cRes.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '60px 40px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13.5 }}>
        <svg className="anim-rotate" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 40px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            Analytics
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-muted)' }}>
            Revenue, products &amp; client insights
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-input)', borderRadius: 8, padding: 3 }}>
          {([
            { label: 'Revenue', value: 'revenue' as const },
            { label: 'Products', value: 'products' as const },
            { label: 'Clients', value: 'clients' as const },
          ]).map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              style={{
                border: 'none', borderRadius: 6, padding: '5px 14px',
                fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                background: tab === t.value ? '#fff' : 'transparent',
                color: tab === t.value ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: tab === t.value ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.12s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue Tab */}
      {tab === 'revenue' && revenue && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
            <StatCard label="Total Revenue" value={formatCurrency(revenue.totals.totalRevenue)} />
            <StatCard label="Avg Order Value" value={formatCurrency(revenue.totals.avgOrderValue)} />
            <StatCard label="Total Orders" value={revenue.totals.totalOrders} />
          </div>

          {/* Monthly trend chart */}
          {revenue.trends.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 14 }}>
                Monthly Revenue
              </h2>
              <div className="card" style={{ padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
                  {revenue.trends.map((t, i) => {
                    const max = Math.max(...revenue.trends.map((tr) => tr.revenue), 1);
                    const isLast = i === revenue.trends.length - 1;
                    return (
                      <div key={t.period} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
                          {formatCurrency(t.revenue)}
                        </span>
                        <div style={{
                          width: '100%', borderRadius: 4, minHeight: 8,
                          height: `${Math.max(8, (t.revenue / max) * 100)}%`,
                          background: isLast ? '#2d7a4f' : 'rgba(45,122,79,0.2)',
                          transition: 'height 0.4s',
                        }} />
                        <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 500 }}>
                          {t.period.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Designer revenue table */}
          {revenue.designerRevenue.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                  Revenue by Designer
                </h2>
                <button
                  onClick={() => exportCSV('designer-revenue.csv',
                    ['Designer', 'Revenue', 'Orders'],
                    revenue.designerRevenue.map((d) => [d.designerName, String(d.revenue), String(d.orderCount)])
                  )}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'none', border: '1px solid var(--border)',
                    borderRadius: 6, padding: '4px 10px',
                    fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export CSV
                </button>
              </div>
              <div className="card" style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['#', 'Designer', 'Revenue', 'Orders', 'Avg Order'].map((h) => (
                        <th key={h} style={{
                          padding: '10px 14px', textAlign: 'left',
                          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.designerRevenue.map((d, i) => (
                      <tr key={d.designerId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{d.designerName}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#2d7a4f' }}>{formatCurrency(d.revenue)}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{d.orderCount}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
                          {d.orderCount > 0 ? formatCurrency(Math.round(d.revenue / d.orderCount)) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Products Tab */}
      {tab === 'products' && products && (
        <>
          {/* Approval Rates */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 14 }}>
              Shortlist Status Breakdown
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${products.approvalRates.length}, 1fr)`, gap: 10 }}>
              {products.approvalRates.map((ar) => {
                const s = SHORTLIST_STATUS_STYLE[ar.status] ?? { color: '#555', bg: '#f0f0f0', label: ar.status };
                return (
                  <div key={ar.status} className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
                      color: s.color, background: s.bg,
                      padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase',
                    }}>{s.label}</span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>{ar.count}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{ar.percentage}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Most Shortlisted */}
          {products.mostShortlisted.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 14 }}>
                Most Shortlisted Products
              </h2>
              <div className="card" style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['#', 'Product', 'Brand', 'Shortlists'].map((h) => (
                        <th key={h} style={{
                          padding: '10px 14px', textAlign: 'left',
                          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.mostShortlisted.map((p, i) => (
                      <tr key={p.productId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.productName}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{p.brandName ?? '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#2d5f7a' }}>{p.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Popular Brands */}
          {products.popularBrands.length > 0 && (
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 14 }}>
                Popular Brands
              </h2>
              <div className="card" style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['#', 'Brand', 'Products'].map((h) => (
                        <th key={h} style={{
                          padding: '10px 14px', textAlign: 'left',
                          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.popularBrands.map((b, i) => (
                      <tr key={b.brandName} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{b.brandName}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{b.productCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Clients Tab */}
      {tab === 'clients' && clients && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
            <StatCard label="Total Clients" value={clients.overview.totalClients} />
            <StatCard label="Avg Projects / Client" value={clients.overview.avgProjectsPerClient} />
            <StatCard label="Avg Order Value" value={formatCurrency(clients.overview.avgOrderValue)} />
          </div>

          {/* Top Clients */}
          {clients.topClients.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                  Top Clients by Revenue
                </h2>
                <button
                  onClick={() => exportCSV('top-clients.csv',
                    ['Client', 'Total Revenue', 'Orders', 'Avg Order'],
                    clients.topClients.map((c) => [c.clientName, String(c.totalOrderValue), String(c.orderCount), String(c.avgOrderValue)])
                  )}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'none', border: '1px solid var(--border)',
                    borderRadius: 6, padding: '4px 10px',
                    fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export CSV
                </button>
              </div>
              <div className="card" style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['#', 'Client', 'Total Revenue', 'Orders', 'Avg Order'].map((h) => (
                        <th key={h} style={{
                          padding: '10px 14px', textAlign: 'left',
                          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.topClients.map((c, i) => (
                      <tr key={c.clientId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.clientName}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#2d7a4f' }}>{formatCurrency(c.totalOrderValue)}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{c.orderCount}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{formatCurrency(c.avgOrderValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Projects per Client */}
          {clients.projectsPerClient.length > 0 && (
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 14 }}>
                Projects per Client
              </h2>
              <div className="card" style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['#', 'Client', 'Projects'].map((h) => (
                        <th key={h} style={{
                          padding: '10px 14px', textAlign: 'left',
                          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.projectsPerClient.map((c, i) => (
                      <tr key={c.clientId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.clientName}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#2d5f7a' }}>{c.projectCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
