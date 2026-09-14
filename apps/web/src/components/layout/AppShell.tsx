'use client';

import TopNav from '@/components/layout/TopNav';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <Sidebar />
      {/* pt-16 clears the fixed TopNav; pb-16 leaves room for the mobile
          bottom nav (lg+: no bottom nav, sidebar takes over). */}
      <main className="min-h-screen pb-16 pt-16 transition-[padding] duration-200 lg:pb-0 lg:pl-60">
        {children}
      </main>
      <BottomNav />
    </>
  );
}