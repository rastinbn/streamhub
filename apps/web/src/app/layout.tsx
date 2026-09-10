import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import AppShell from '@/components/layout/AppShell';
import RouteChangeEmitter from '@/components/layout/RouteChangeEmitter';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';


const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'StreamHub',
  description: 'Watch and go live.',
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
