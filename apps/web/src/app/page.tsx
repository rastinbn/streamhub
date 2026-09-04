'use client';

import Link from 'next/link';
import HeroSection, { HeroData } from '@/components/home/HeroSection';
import HomeStreamCard, { HomeStreamCardData } from '@/components/home/HomeStreamCard';
import { useStreams } from '@/hooks/useStreams';
import { formatCompact } from '@/lib/format';
import { MISSING_NAME, PLACEHOLDER_ALT, PLACEHOLDER_AVATAR, PLACEHOLDER_THUMBNAIL, UNTITLED } from '@/lib/placeholders';
import { ChevronDown, Radio } from 'lucide-react';
import type { StreamPublic } from '@streamhub/types';

// Editorial hero — there is no "featured stream" endpoint in the contract, so
// this stays curated. The grid below it is backed by the real live-streams API.
const HERO: HeroData = {
  title: 'Pro Tournament Finals: Group Stage Day 1',
  streamerName: 'StellarGaming',
  category: 'Valorant',
  tags: ['FPS', 'Competitive', 'Drops'],
  viewerCount: '25.4K',
  thumbnailUrl:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDlMp5ZXNR20d9IRJy4GD64fFT1-ZgL_ePf_XDGkuHDfvudIJ9kBfB-i9Gfu1Abxx9QpUj8XPSnMIUusbTNjAmdV1U9tVvHgyAyFw9-b3UTanjgcvBnDPihB1La_eisiu0FUK1xYobElR2iiXkIS5056TYmIbDSRGrjH5CHQp1Ua8hl_6oi6Mahu8ZE-Ij8Y9SA-X2snF9R1rn9hrYjIsJETZC2PJKurvyhR0pwecwAKktOWwxyYasfWA',
  thumbnailAlt:
    'A high-octane esports tournament final match in a massive stadium. The perspective is from behind a pro player looking at their monitor, showing a tense moment in an FPS game. The stadium is illuminated with dazzling neon lasers and dramatic volumetric smoke. The overall mood is electrifying, competitive, and technologically advanced, with deep blacks and vibrant primary colors.',
  avatarUrl:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDBY3XXk5g9KeNZXLQ-l9Tuh6zIw24cCf5sFYTA9-iUdXFmxA5l8hHwna5XtM29k7a6UIqdxJQSJwWqgDOQPbLdNirXLf4CaIfAe2LTdcbzd8FaB8VoYH0vHy4EPAfQ7acxn3b2WzCZXRQyqW5MNF9hA_QE43Nzt9OPQaPYRhpWY_BNRLJ7xX3R-g7SJdMf9CiaOAWtR6-63REqR8rDI9GN5fsexc6j1mbrAtg83bAe2DCxmk9Bxdx9Ow',
  avatarAlt:
    'A close-up portrait of a professional gamer with a focused expression, wearing a premium gaming headset. The lighting is cinematic, featuring dramatic purple and cyan rim lighting against a dark background. The aesthetic is sleek and modern.',
};

// The API returns a stream's title/category/viewers/thumbnail/status but no
// channel name or avatar — render neutral placeholders for those.
function toHomeCard(stream: StreamPublic, index: number): HomeStreamCardData {
  return {
    id: stream.id,
    title: stream.title ?? UNTITLED,
    streamerName: MISSING_NAME,
    category: stream.category ?? MISSING_NAME,
    viewerCount: formatCompact(stream.viewerCount),
    thumbnailUrl: stream.thumbnail ?? PLACEHOLDER_THUMBNAIL,
    thumbnailAlt: PLACEHOLDER_ALT,
    avatarUrl: PLACEHOLDER_AVATAR,
    avatarAlt: PLACEHOLDER_ALT,
    showFrom: index < 2 ? 'all' : index < 4 ? 'sm' : 'lg',
  };
}

export default function Home() {
  const { streams, isLoading, isError, error } = useStreams({}, { liveOnly: true });
  const hasStreams = streams.length > 0;

  return (
    <div className="mx-auto w-full max-w-[1600px] flex-1 p-md pt-16 md:p-lg md:pt-0 lg:p-layout-margin">
      <div className="flex flex-col gap-xl">
        {/* Featured Hero */}
        <div className="rounded-xl motion-safe:animate-[fade-in-up_400ms_ease-out_backwards]">
          <HeroSection hero={HERO} />
        </div>

        {/* Live Now */}
        <section className="flex flex-col gap-md">
          <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-sm">
            <span className="h-3 w-3 rounded-full bg-error animate-pulse" />
            Live Now
          </h2>

          {isLoading && !hasStreams ? (
            <p className="text-body-sm text-on-surface-variant">Loading live streams…</p>
          ) : isError && !hasStreams ? (
            <p role="alert" className="text-body-sm text-error">
              {error ?? 'Failed to load live streams.'}
            </p>
          ) : !hasStreams ? (
            <div className="flex flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-outline-variant py-2xl text-center">
              <Radio className="h-8 w-8 text-outline" />
              <p className="text-body-md font-body-md text-on-surface-variant">
                Nothing live right now — check back soon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-lg">
              {streams.map((stream, i) => {
                const card = toHomeCard(stream, i);
                return (
                  <div key={card.id} className={card.showFrom === 'all' ? '' : card.showFrom === 'sm' ? 'hidden sm:block' : 'hidden lg:block'}>
                    <div
                      className="motion-safe:animate-[fade-in-up_400ms_ease-out_backwards]"
                      style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                    >
                      <HomeStreamCard stream={card} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Link
            href="/browse"
            className="mt-4 self-center md:self-start text-primary font-label-md text-label-md hover:underline font-bold flex items-center gap-1"
          >
            Show More
            <ChevronDown className="h-[18px] w-[18px]" />
          </Link>
        </section>
      </div>
    </div>
  );
}