import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarPlus, ShieldCheck } from 'lucide-react';
import { usersApi } from '@/lib/api';
import { PLACEHOLDER_AVATAR, MISSING_NAME } from '@/lib/placeholders';

export const dynamic = 'force-dynamic';

function formatJoined(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default async function UserProfilePage({
  params,
}: {
  params: { username: string };
}) {
  let user;
  try {
    user = await usersApi.getProfile(params.username);
  } catch {
    notFound();
  }

  const avatarUrl = user.avatar ?? PLACEHOLDER_AVATAR;
  const displayName = user.displayName ?? user.username ?? MISSING_NAME;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-lg lg:py-xl">
      <div className="flex flex-col items-start gap-md rounded-2xl border border-outline-variant/30 bg-surface-container-low p-lg sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={`${displayName}'s avatar`}
          width={96}
          height={96}
          className="h-24 w-24 shrink-0 rounded-full border-2 border-outline-variant object-cover"
        />
        <div className="min-w-0">
          <h1 className="font-headline-md text-headline-md text-on-surface">{displayName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="font-body-sm text-body-sm text-on-surface-variant">@{user.username}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-variant/60 px-2 py-0.5 font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
              <ShieldCheck className="h-3 w-3" />
              {user.role === 'ADMIN' ? 'Admin' : user.role === 'MODERATOR' ? 'Moderator' : user.role === 'STREAMER' ? 'Streamer' : 'Member'}
            </span>
          </div>
          {user.bio && (
            <p className="mt-3 font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
              {user.bio}
            </p>
          )}
          <p className="mt-3 inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant/70">
            <CalendarPlus className="h-3.5 w-3.5" />
            Joined {formatJoined(user.createdAt)}
          </p>
        </div>
      </div>

      <div className="mt-lg rounded-2xl border border-outline-variant/30 bg-surface-container-low p-lg">
        <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
          This profile surfaces the public fields of <span className="font-semibold text-on-surface">@{user.username}</span>.
          Followed channels and current broadcasts will appear here once the full channel profile
          page is built.
        </p>
        <Link
          href="/browse"
          className="mt-md inline-block rounded-lg bg-primary px-4 py-2 font-label-md text-label-md font-bold text-on-primary shadow-sm transition-transform active:scale-95"
        >
          Browse live streams
        </Link>
      </div>
    </main>
  );
}