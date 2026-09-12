import type { Metadata } from 'next';
import StreamerRequired from '@/components/layout/StreamerRequired';

export const metadata: Metadata = {
  title: 'Creator Dashboard',
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <StreamerRequired>{children}</StreamerRequired>;
}