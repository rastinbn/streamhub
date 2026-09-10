import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to StreamHub to watch, chat and go live.',
  alternates: { canonical: `${SITE_URL}/login` },
  openGraph: { type: 'website', url: `${SITE_URL}/login`, title: 'Log in' },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}