import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'tradeLiv — Trade. Design. Deliver.',
  description: 'The professional trade platform for interior designers and their clients. Manage projects, curate products, and place orders.',
  openGraph: {
    title: 'Tradeliv — Trade. Design. Deliver.',
    description: 'The professional trade platform for interior designers. Manage clients, curate products, and streamline orders.',
    type: 'website',
    siteName: 'Tradeliv',
  },
  twitter: {
    card: 'summary',
    title: 'Tradeliv — Trade. Design. Deliver.',
    description: 'The professional trade platform for interior designers.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
