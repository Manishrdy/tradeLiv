import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: 'tradeLiv — Trade. Design. Deliver.',
  description: 'The sourcing platform for interior designers. Extract products from 500+ brands, compare cross-brand, collaborate with clients in real time, and place consolidated orders.',
  openGraph: {
    title: 'tradeLiv — Trade. Design. Deliver.',
    description: 'The sourcing platform for interior designers. Compare products across brands, collaborate with clients, and place consolidated orders — all from one dashboard.',
    type: 'website',
    siteName: 'tradeLiv',
    images: [{ url: '/landing/sofa-1.jpg', width: 1200, height: 630, alt: 'tradeLiv — The sourcing platform for interior designers' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'tradeLiv — Trade. Design. Deliver.',
    description: 'The sourcing platform for interior designers. One platform, one order.',
    images: ['/landing/sofa-1.jpg'],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
