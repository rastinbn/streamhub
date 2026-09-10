'use client';

import { useRequireAuth } from '@/lib/use-require-auth';

/**
 * Client-side guard for whole route segments. Renders nothing while the
 * session is still being rehydrated; `useRequireAuth` redirects to /login
 * once it is known the visitor has no session.
 */
export default function AuthRequired({ children }: { children: React.ReactNode }) {
  const { loading, user } = useRequireAuth();
  if (loading || !user) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-body-sm text-on-surface-variant">Loading…</p>
      </div>
    );
  }
  return <>{children}</>;
}