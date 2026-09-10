import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import AppShell from '@/components/layout/AppShell';
import RouteChangeEmitter from '@/components/layout/RouteChangeEmitter';
import { AuthProvider } from '@/lib/auth-context';
import { DEFAULT_DESCRIPTION, SITE_KEYWORDS, SITE_URL } from '@/lib/seo';
import './globals.css';


const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'StreamHub — Watch and go live',
    template: '%s · StreamHub',
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: 'StreamHub',
  keywords: SITE_KEYWORDS,
  authors: [{ name: 'StreamHub', url: SITE_URL }],
  creator: 'StreamHub',
  publisher: 'StreamHub',
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: 'website',
    siteName: 'StreamHub',
    locale: 'en_US',
    url: SITE_URL,
    title: 'StreamHub — Watch and go live',
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@streamhub',
    title: 'StreamHub — Watch and go live',
    description: DEFAULT_DESCRIPTION,
  },
  robots: { index: true, follow: true },
  category: 'live streaming',
};

export const viewport: Viewport = {
  themeColor: '#111417',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AuthProvider>
          <RouteChangeEmitter />
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
