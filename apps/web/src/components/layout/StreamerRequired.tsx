'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { canStream } from '@/lib/roles';

/**
 * Client-side guard for the creator dashboard segment. Redirects unsigned
 * visitors to /login and normal USER accounts to /become-streamer; only
 * STREAMER/MODERATOR/ADMIN accounts see the children.
 */
export default function StreamerRequired({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?redirect=/dashboard');
      return;
    }
    if (!canStream(user.role)) {
      router.replace('/become-streamer');
    }
  }, [loading, user, router]);

  if (loading || !user || !canStream(user.role)) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-body-sm text-on-surface-variant">Loading…</p>
      </div>
    );
  }
  return <>{children}</>;
}