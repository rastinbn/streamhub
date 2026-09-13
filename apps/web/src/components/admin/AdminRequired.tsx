'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

/**
 * Client-side gate for the whole `/admin` segment. Redirects unauthenticated
 * visitors to /login and non-staff (anything below MODERATOR) away from the
 * panel. The API independently enforces the roles on every request (ADMIN for
 * most sections, MODERATOR/ADMIN for reports), so this is purely a UX layer.
 */
export default function AdminRequired({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') router.replace('/');
  }, [loading, user, router]);

  if (loading || !user || (user.role !== 'ADMIN' && user.role !== 'MODERATOR')) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-body-sm text-on-surface-variant">Loading…</p>
      </div>
    );
  }
  return <>{children}</>;
}