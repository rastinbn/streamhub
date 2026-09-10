import AuthRequired from '@/components/layout/AuthRequired';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AuthRequired>{children}</AuthRequired>;
}