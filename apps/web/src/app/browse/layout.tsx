import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Browse Streams',
  description:
    'Browse live and past streams on StreamHub — filter by category, most viewed or recently started and find your next favorite streamer.',
  alternates: { canonical: `${SITE_URL}/browse` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/browse`,
    title: 'Browse Streams',
    description:
      'Browse live and past streams on StreamHub — filter by category, most viewed or recently started and find your next favorite streamer.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Browse Streams',
    description:
      'Browse live and past streams on StreamHub — filter by category, most viewed or recently started and find your next favorite streamer.',
  },
};

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}