import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Create account',
  description: 'Create your StreamHub account and start watching, chatting and going live.',
  alternates: { canonical: `${SITE_URL}/register` },
  openGraph: { type: 'website', url: `${SITE_URL}/register`, title: 'Create account' },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}