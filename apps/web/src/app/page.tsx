import type { Metadata } from 'next';
import HomeFeed from '@/components/home/HomeFeed';
import { DEFAULT_DESCRIPTION, SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Watch and go live',
  description: DEFAULT_DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: { type: 'website', url: SITE_URL },
};

export default function Home() {
  return <HomeFeed />;
}