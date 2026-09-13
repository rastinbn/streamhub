'use client';

import { useEffect, useState } from 'react';
import TopNav from '@/components/layout/TopNav';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => e.matches && setDrawerOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <>
      <TopNav menuOpen={drawerOpen} onMenuClick={() => setDrawerOpen((v) => !v)} />
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      {/* pt-16 clears the fixed TopNav; pb-16 leaves room for the mobile
          bottom nav (lg+: no bottom nav, sidebar takes over). */}
      <main className="min-h-screen pb-16 pt-16 transition-[padding] duration-200 lg:pb-0 lg:pl-60">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
