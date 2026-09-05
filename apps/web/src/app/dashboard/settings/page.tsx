'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useUpdateProfile } from '@/hooks/useUpdateProfile';
import { useRequireAuth } from '@/lib/use-require-auth';

export default function SettingsPage() {
  const { user, loading } = useRequireAuth();
  const { submitting, update } = useUpdateProfile();

  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Seed the form once the user is known.
  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName ?? '');
    setAvatar(user.avatar ?? '');
    setBio(user.bio ?? '');
  }, [user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    setError(null);
    setSuccess(false);
    const result = await update({
      displayName: displayName || undefined,
      avatar: avatar || undefined,
      bio: bio || undefined,
    });
    if (result.ok) {
      setSuccess(true);
    } else if (result.error) {
      setError(result.error);
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-body-sm text-on-surface-variant">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-headline-md text-on-surface">Account settings</h1>
      <p className="mt-1 text-body-sm text-on-surface-variant">
        Signed in as <span className="font-semibold text-on-surface">{user.username}</span> ({user.email})
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-low p-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="displayName" className="text-label-md text-on-surface-variant">
            Display name
          </label>
          <input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
            className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="How your name appears to others"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="avatar" className="text-label-md text-on-surface-variant">
            Avatar URL
          </label>
          <input
            id="avatar"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            maxLength={500}
            className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="https://…"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="bio" className="text-label-md text-on-surface-variant">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={4}
            className="resize-none rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Tell people a bit about yourself"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-body-sm text-on-error-container">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="rounded-lg bg-secondary-container px-3 py-2 text-body-sm text-on-secondary-container">
            Profile updated.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 self-start rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
