import type { Metadata } from 'next';
import AuthRequired from '@/components/layout/AuthRequired';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AuthRequired>{children}</AuthRequired>;
}