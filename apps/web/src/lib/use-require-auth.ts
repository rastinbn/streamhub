'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-context';

/**
 * Redirects to /login once we know for certain there's no session (i.e.
 * after the initial silent-refresh check has finished). While that check is
 * in flight, `loading` stays true and callers should render a loading state
 * rather than flashing a redirect.
 */
export function useRequireAuth() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  return { user, loading };
}
