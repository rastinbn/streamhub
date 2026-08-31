'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { login, resendVerification } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setResendState('idle');
    setSubmitting(true);
    try {
      await login({ identifier, password });
      router.push('/');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setNeedsVerification(true);
        setError(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    // The identifier field doubles as email/username on this form; resend
    // only makes sense with an email, but the endpoint no-ops harmlessly on
    // a username or unknown address rather than erroring.
    setResendState('sending');
    try {
      await resendVerification(identifier);
      setResendState('sent');
    } catch {
      setResendState('idle');
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-outline-variant/30 bg-surface-container-low p-8 shadow-xl">
        <h1 className="font-display text-headline-md text-on-surface">Log in to StreamHub</h1>
        <p className="mt-1 text-body-sm text-on-surface-variant">Welcome back — catch the next stream.</p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="identifier" className="text-label-md text-on-surface-variant">
              Username or email
            </label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="codeninja"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-label-md text-on-surface-variant">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-body-sm text-on-error-container">
              {error}
            </p>
          )}

          {needsVerification && (
            <button
              type="button"
              onClick={onResend}
              disabled={resendState === 'sending' || resendState === 'sent'}
              className="text-left text-body-sm font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendState === 'sent'
                ? 'Verification email sent — check your inbox.'
                : resendState === 'sending'
                  ? 'Sending…'
                  : 'Resend verification email'}
            </button>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-center text-body-sm text-on-surface-variant">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
