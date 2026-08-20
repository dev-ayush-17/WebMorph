import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Undying Scraper — Price & Stock Monitor',
  description:
    'Self-healing product price and stock tracker. Live data sourced via Bright Data Scraper Studio, stored in Supabase, and monitored for extraction failures.',
  keywords: ['price tracker', 'stock monitor', 'bright data', 'scraper', 'supabase'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
