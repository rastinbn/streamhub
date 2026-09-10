import AdminRequired from '@/components/admin/AdminRequired';
import AdminNav from '@/components/admin/AdminNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminRequired>
      <div className="min-h-[calc(100vh-64px)] bg-surface-container-lowest">
        <div className="mx-auto max-w-7xl px-layout-gutter py-md md:px-layout-margin lg:py-lg">
          <AdminNav />
          {children}
        </div>
      </div>
    </AdminRequired>
  );
}