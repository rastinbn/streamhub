'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useUpdateProfile } from '@/hooks/useUpdateProfile';
import { useRequireAuth } from '@/lib/use-require-auth';
import { isSafeImageSrc } from '@/lib/security';
import { ApiError, channelsApi, usersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useCategories } from '@/hooks/useCategories';
import type { ChannelPublic } from '@streamhub/types';

export default function SettingsPage() {
  const { user, loading } = useRequireAuth();
  const { accessToken } = useAuth();
  const { submitting, update } = useUpdateProfile();
  const { categories } = useCategories();

  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // --- Channel settings state ---
  const [channel, setChannel] = useState<ChannelPublic | null>(null);
  const [channelLoading, setChannelLoading] = useState(true);
  const [chName, setChName] = useState('');
  const [chDescription, setChDescription] = useState('');
  const [chAvatar, setChAvatar] = useState('');
  const [chBanner, setChBanner] = useState('');
  const [chCategory, setChCategory] = useState('');
  const [chBusy, setChBusy] = useState(false);
  const [chError, setChError] = useState<string | null>(null);
  const [chSuccess, setChSuccess] = useState(false);

  // Seed the form once the user is known.
  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName ?? '');
    setAvatar(user.avatar ?? '');
    setBio(user.bio ?? '');
  }, [user]);

  // Load the caller's channel (if any) for the channel settings section.
  useEffect(() => {
    if (!accessToken) return;
    setChannelLoading(true);
    usersApi
      .getMyChannel(accessToken)
      .then((ch) => {
        setChannel(ch);
        setChName(ch.name);
        setChDescription(ch.description ?? '');
        setChAvatar(ch.avatar ?? '');
        setChBanner(ch.banner ?? '');
        setChCategory(ch.category ?? '');
      })
      .catch(() => setChannel(null)) // no channel yet — section hides
      .finally(() => setChannelLoading(false));
  }, [accessToken]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    setError(null);
    setSuccess(false);
    if (avatar && !isSafeImageSrc(avatar)) {
      setError('Avatar URL must be an http(s) URL or a local path.');
      return;
    }
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

  async function onChannelSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !channel) return;

    setChError(null);
    setChSuccess(false);
    if (chAvatar && !isSafeImageSrc(chAvatar)) {
      setChError('Avatar URL must be an http(s) URL or a local path.');
      return;
    }
    if (chBanner && !isSafeImageSrc(chBanner)) {
      setChError('Banner URL must be an http(s) URL or a local path.');
      return;
    }

    setChBusy(true);
    try {
      const updated = await channelsApi.update(accessToken, channel.id, {
        name: chName.trim() || undefined,
        description: chDescription.trim() || undefined,
        avatar: chAvatar.trim() || undefined,
        banner: chBanner.trim() || undefined,
        category: chCategory || undefined,
      });
      setChannel(updated);
      setChSuccess(true);
    } catch (err) {
      setChError(err instanceof ApiError ? err.message : 'Could not update the channel.');
    } finally {
      setChBusy(false);
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

      {channel && (
        <section className="mt-10">
          <h2 className="font-display text-headline-md text-on-surface">Channel settings</h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Live at{' '}
            <a
              href={`/channel/${channel.slug}`}
              className="text-primary hover:underline"
            >
              /channel/{channel.slug}
            </a>{' '}
            · {channel.followersCount} followers
          </p>

          <form
            onSubmit={onChannelSubmit}
            className="mt-6 flex flex-col gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-low p-6"
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="chName" className="text-label-md text-on-surface-variant">
                Channel name
              </label>
              <input
                id="chName"
                value={chName}
                onChange={(e) => setChName(e.target.value)}
                maxLength={50}
                className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Channel name"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="chCategory" className="text-label-md text-on-surface-variant">
                Category
              </label>
              <select
                id="chCategory"
                value={chCategory}
                onChange={(e) => setChCategory(e.target.value)}
                className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="chDescription" className="text-label-md text-on-surface-variant">
                Description
              </label>
              <textarea
                id="chDescription"
                value={chDescription}
                onChange={(e) => setChDescription(e.target.value)}
                maxLength={500}
                rows={3}
                className="resize-none rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="What is your channel about?"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="chAvatar" className="text-label-md text-on-surface-variant">
                Avatar URL
              </label>
              <input
                id="chAvatar"
                value={chAvatar}
                onChange={(e) => setChAvatar(e.target.value)}
                maxLength={500}
                className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="https://…"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="chBanner" className="text-label-md text-on-surface-variant">
                Banner URL
              </label>
              <input
                id="chBanner"
                value={chBanner}
                onChange={(e) => setChBanner(e.target.value)}
                maxLength={500}
              
                className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="https://…"
              />
            </div>

            {chError && (
              <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-body-sm text-on-error-container">
                {chError}
              </p>
            )}
            {chSuccess && (
              <p role="status" className="rounded-lg bg-secondary-container px-3 py-2 text-body-sm text-on-secondary-container">
                Channel updated.
              </p>
            )}

            <button
              type="submit"
              disabled={chBusy}
              className="mt-2 self-start rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {chBusy ? 'Saving…' : 'Save channel'}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
