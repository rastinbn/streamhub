'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { User, Mail, ShieldCheck, Bell, Monitor, LogOut, Moon, Sun, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useUpdateProfile } from '@/hooks/useUpdateProfile';
import { useRequireAuth } from '@/lib/use-require-auth';
import { isSafeImageSrc } from '@/lib/security';
import { cn } from '@/lib/utils';
import { ACCENTS, useTheme } from '@/lib/theme-context';
import { useRouter } from 'next/navigation';

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-md md:p-lg">
      <div className="flex items-center gap-sm">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-container/20 text-primary">
          {icon}
        </span>
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">{title}</h2>
          <p className="mt-0.5 text-body-sm font-body-sm text-on-surface-variant">{description}</p>
        </div>
      </div>
      <div className="mt-md">{children}</div>
    </section>
  );
}

const inputClass =
  'w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { submitting, update } = useUpdateProfile();
  useRequireAuth();
  const { theme, setTheme, accent, setAccent } = useTheme();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '');
  const [notifyEvents, setNotifyEvents] = useState(true);
  const [notifyCommunity, setNotifyCommunity] = useState(false);
  const [notifyEntertainment, setNotifyEntertainment] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  // user arrives asynchronously (auth rehydration) — mirror it into the form
  // so the fields populate once the session is known.
  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName ?? '');
    setBio(user.bio ?? '');
    setAvatar(user.avatar ?? '');
  }, [user]);

  const resolvedLoading = loading || (user === null && !loading ? false : loading);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (avatar && !isSafeImageSrc(avatar)) {
      setMessage({ type: 'error', text: 'Avatar URL must be an http(s) URL or a local path.' });
      return;
    }
    const result = await update({ displayName, bio, avatar: avatar || undefined });
    if (result.ok) {
      setMessage({ type: 'ok', text: 'Profile updated.' });
    } else {
      setMessage({ type: 'error', text: result.error ?? 'Failed to update profile.' });
    }
  }

  async function onLogout() {
    await logout();
    router.push('/');
  }

  if (resolvedLoading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-body-sm text-on-surface-variant">Loading settings…</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const verifiedBadge = user.emailVerified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-online/15 px-2.5 py-0.5 font-label-sm text-label-sm text-online">
      Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-error/15 px-2.5 py-0.5 font-label-sm text-label-sm text-error">
      Unverified
    </span>
  );

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 p-md pt-16 md:p-lg md:pt-0 lg:p-xl">
      <div className="mb-lg">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Settings</h1>
        <p className="mt-xs text-body-md font-body-md text-on-surface-variant">
          Manage your profile, account and StreamHub preferences.
        </p>
      </div>

      <div className="flex flex-col gap-lg">
        {/* Profile */}
        <SectionCard icon={<User className="h-4 w-4" />} title="Profile" description="How you appear around StreamHub.">
          <form onSubmit={onSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="displayName" className="text-label-md font-label-md text-on-surface-variant">
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={user.username}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="avatar" className="text-label-md font-label-md text-on-surface-variant">
                Avatar URL
              </label>
              <input
                id="avatar"
                type="url"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="https://…"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="bio" className="text-label-md font-label-md text-on-surface-variant">
                Bio
              </label>
              <textarea
                id="bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell your community a little about yourself."
                className={`${inputClass} resize-none`}
              />
            </div>

            {message && (
              <p
                role={message.type === 'error' ? 'alert' : 'status'}
                className={cn(
                  'rounded-lg px-3 py-2 text-body-sm font-body-sm',
                  message.type === 'ok'
                    ? 'bg-online/10 text-online'
                    : 'bg-error-container text-on-error-container',
                )}
              >
                {message.text}
              </p>
            )}

            <div className="flex items-center gap-sm">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </SectionCard>

        {/* Account */}
        <SectionCard
          icon={<Mail className="h-4 w-4" />}
          title="Account"
          description="Your sign-in identity and security details."
        >
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-surface-container p-md">
              <dt className="text-label-sm font-label-sm uppercase tracking-wide text-on-surface-variant">Username</dt>
              <dd className="mt-1 truncate font-body-md text-body-md text-on-surface">{user.username}</dd>
            </div>
            <div className="rounded-lg bg-surface-container p-md">
              <dt className="text-label-sm font-label-sm uppercase tracking-wide text-on-surface-variant">Email</dt>
              <dd className="mt-1 truncate font-body-md text-body-md text-on-surface">{user.email}</dd>
            </div>
            <div className="rounded-lg bg-surface-container p-md">
              <dt className="text-label-sm font-label-sm uppercase tracking-wide text-on-surface-variant">Role</dt>
              <dd className="mt-1 flex items-center gap-2 font-body-md text-body-md text-on-surface">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {user.role}
              </dd>
            </div>
            <div className="rounded-lg bg-surface-container p-md">
              <dt className="text-label-sm font-label-sm uppercase tracking-wide text-on-surface-variant">Email status</dt>
              <dd className="mt-1">{verifiedBadge}</dd>
            </div>
          </dl>
        </SectionCard>

        {/* Notifications */}
        <SectionCard
          icon={<Bell className="h-4 w-4" />}
          title="Notifications"
          description="Choose how you hear from StreamHub."
        >
          <div className="flex flex-col">
            {[
              { key: 'events', label: 'Events & product updates', value: notifyEvents, set: setNotifyEvents },
              { key: 'community', label: 'Community messages', value: notifyCommunity, set: setNotifyCommunity },
              { key: 'entertainment', label: 'Entertainment & creator news', value: notifyEntertainment, set: setNotifyEntertainment },
            ].map((row) => (
              <label
                key={row.key}
                className="flex cursor-pointer items-center justify-between gap-4 border-b border-outline-variant/30 py-sm last:border-0"
              >
                <span className="font-body-md text-body-md text-on-surface">{row.label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={row.value}
                  onClick={() => row.set(!row.value)}
                  className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  row.value ? 'bg-primary-container' : 'bg-surface-variant',
                )}
                >
                  <span
                    className={cn(
                      'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                      row.value ? 'translate-x-[1.5rem]' : 'translate-x-0.5',
                    )}
                  />
                </button>
              </label>
            ))}
          </div>
        </SectionCard>

        {/* Appearance — mode + accent, persisted locally (Phase 12+). */}
        <SectionCard
          icon={<Monitor className="h-4 w-4" />}
          title="Appearance"
          description="Pick a color palette — it applies everywhere instantly."
        >
          <div className="flex flex-col gap-lg">
            {/* Mode: dark / light */}
            <div>
              <p className="mb-2 text-label-lg font-label-lg text-on-surface-variant">Mode</p>
              <div
                role="radiogroup"
                aria-label="Color mode"
                className="grid grid-cols-2 gap-sm sm:max-w-xs"
              >
                {([
                  { id: 'dark' as const, label: 'Dark', Icon: Moon },
                  { id: 'light' as const, label: 'Light', Icon: Sun },
                ]).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={theme === id}
                    onClick={() => setTheme(id)}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      theme === id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-outline-variant/40 text-on-surface-variant hover:border-outline-variant hover:text-on-surface',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent palette picker */}
            <div>
              <p className="mb-2 text-label-lg font-label-lg text-on-surface-variant">Color</p>
              <div
                role="radiogroup"
                aria-label="Accent color"
                className="grid grid-cols-2 gap-sm sm:grid-cols-3"
              >
                {ACCENTS.map((a) => {
                  const selected = accent === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setAccent(a.id)}
                      className={cn(
                        'group flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        selected
                          ? 'border-primary bg-primary/10'
                          : 'border-outline-variant/40 hover:border-outline-variant',
                      )}
                    >
                      {/* Three-tone preview using the accent's real colors. */}
                      <span className="flex h-10 w-full overflow-hidden rounded-lg">
                        <span className="h-full flex-[2]" style={{ background: a.swatch[0] }} />
                        <span className="h-full flex-1" style={{ background: a.swatch[1] }} />
                        <span className="h-full flex-1" style={{ background: a.swatch[2] }} />
                      </span>
                      <span
                        className={cn(
                          'flex items-center gap-1.5 text-sm font-medium',
                          selected ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface',
                        )}
                      >
                        {selected && <Check className="h-3.5 w-3.5" aria-hidden />}
                        {a.label}
                      </span>
                      <span className="sr-only">{selected ? 'Selected' : 'Not selected'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Sign out */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void onLogout()}
            className="inline-flex items-center gap-2 rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error/10"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}