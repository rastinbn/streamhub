import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Categories',
  description: 'Explore every category on StreamHub — gaming, music, sports, just chatting and more.',
  alternates: { canonical: `${SITE_URL}/categories` },
  openGraph: { type: 'website', url: `${SITE_URL}/categories`, title: 'Categories' },
  twitter: { card: 'summary_large_image', title: 'Categories' },
};

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}