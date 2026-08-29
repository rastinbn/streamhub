'use client';

import { useEffect, useState } from 'react';
import TopNav from '@/components/TopNav';
import SideBar from '@/components/SideBar';

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
      <SideBar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      {/* Offset for the fixed top nav (h-16) and fixed sidebar on desktop (w-60) */}
      <main className="min-h-screen pt-16 transition-[padding] duration-200 lg:pl-60">
        {children}
      </main>
    </>
  );
}
