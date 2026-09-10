import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Following',
  description: 'Streams from channels you follow on StreamHub.',
  robots: { index: false, follow: false },
};

export default function FollowingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}