import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'Nipuna Tea Collectors - Tea Collection & Financial Management',
  description: 'Tea Collection and Financial Management System for Nipuna Tea Collectors warehouse. Manage customers, tea leaf collections, payments, and driver commissions.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
