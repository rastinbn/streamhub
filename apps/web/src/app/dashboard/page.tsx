'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@streamhub/ui';
import RoutePlaceholder from '@/components/route-placeholder';

const TABS = [
  { value: '/dashboard', label: 'Overview' },
  { value: '/dashboard/stream', label: 'Stream' },
  { value: '/dashboard/analytics', label: 'Analytics' },
  { value: '/dashboard/content', label: 'Content' },
  { value: '/dashboard/settings', label: 'Settings' },
];

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex-1 pt-16 md:pt-0 p-md md:p-lg lg:p-xl w-full">
      <div className="max-w-[1920px] mx-auto">
        <h1 className="text-headline-lg-mobile md:text-headline-lg font-headline-lg text-on-surface mb-md">
          Creator Dashboard
        </h1>
        <Tabs value={pathname} onValueChange={(value) => router.push(value)}>
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="mt-lg">
          <RoutePlaceholder route="/dashboard" description="Creator dashboard overview." />
        </div>
      </div>
    </div>
  );
}
