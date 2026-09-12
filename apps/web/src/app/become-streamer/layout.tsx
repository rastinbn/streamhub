import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Become a Streamer',
  robots: { index: false, follow: false },
};

export default function BecomeStreamerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}