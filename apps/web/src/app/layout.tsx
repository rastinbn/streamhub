import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import AppShell from '@/components/layout/AppShell';
import RouteChangeEmitter from '@/components/layout/RouteChangeEmitter';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider, THEME_STORAGE_KEY, ACCENT_STORAGE_KEY } from '@/lib/theme-context';
import { ACCENT_IDS } from '@/lib/theme-accents';
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

/**
 * Runs before first paint to apply the persisted theme — both axes, mode
 * (or the OS preference on first visit) and accent — so there is no flash
 * of the wrong theme. Deliberately tiny and inline; it must not be an
 * external chunk, so the accent-id allow-list is inlined by the bundler
 * from theme-context (single source of truth).
 */
const themeBootstrap = `(function(){try{
var t=localStorage.getItem('${THEME_STORAGE_KEY}');
if(t==='light'||(t===null&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches)){document.documentElement.classList.add('light')}
var a=localStorage.getItem('${ACCENT_STORAGE_KEY}');
if(${JSON.stringify(ACCENT_IDS.filter((id) => id !== 'purple'))}.indexOf(a)>-1){document.documentElement.classList.add('accent-'+a)}
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <RouteChangeEmitter />
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
