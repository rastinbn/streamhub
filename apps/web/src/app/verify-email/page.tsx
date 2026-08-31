'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type Status = 'verifying' | 'success' | 'error';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyEmail } = useAuth();

  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState<string | null>(null);
  // Effects run twice in dev (React Strict Mode); the token is single-use,
  // so guard against firing the request a second time.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('This verification link is missing its token.');
      return;
    }

    verifyEmail(token)
      .then(() => {
        setStatus('success');
        setTimeout(() => router.push('/'), 1500);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof ApiError ? err.message : 'This verification link is invalid or has expired.');
      });
  }, [searchParams, verifyEmail, router]);

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-outline-variant/30 bg-surface-container-low p-8 text-center shadow-xl">
        {status === 'verifying' && (
          <>
            <h1 className="font-display text-headline-md text-on-surface">Verifying your email…</h1>
            <p className="mt-2 text-body-sm text-on-surface-variant">One moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 className="font-display text-headline-md text-on-surface">Email verified!</h1>
            <p className="mt-2 text-body-sm text-on-surface-variant">You&apos;re logged in — redirecting…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="font-display text-headline-md text-on-surface">Verification failed</h1>
            <p className="mt-2 text-body-sm text-on-surface-variant">{message}</p>
            <p className="mt-6 text-body-sm text-on-surface-variant">
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Go to login
              </Link>{' '}
              to request a new link.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
          <p className="text-body-sm text-on-surface-variant">Loading…</p>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
