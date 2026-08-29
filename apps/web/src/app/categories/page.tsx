'use client';

import { useMemo, useState } from 'react';
import CategoryCard, { type CategoryCardProps } from '@/components/CategoryCard';
import { LayoutGrid, Gamepad2, Users, Music2, Cpu, Trophy, Palette } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const categories: CategoryCardProps[] = [
  {
    name: 'Cyber Eclipse 2077',
    badge: 'Gaming',
    viewers: '142K',
    liveChannels: '2.4K Live Channels',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDkkLsCkJGcEFyqd926i-qlWdLy8tXwQkOSt5zSv3vJ3hb3CRpOrsiW1dpCTJl1dQtTeDtWTnqxHT_Utney0RMeYTS4FHdyxNEU9PXd2fPB85B0Xl6XGns3IK3Tz1gAasHWHcxdQWo4S4H97ll3_9wpaRQudRaNUHjzX6St4Xdku2RVDkLqa8_qIp_eCsl9pb-7-mbRlZvqSdoYo0UrvGYUz3zttc7IB-Lpb7YnF27YER11mpIfKVjAfQ',
    alt: 'Gaming Cover',
  },
  {
    name: 'Just Chatting',
    badge: 'IRL',
    viewers: '350K',
    liveChannels: '5.1K Live Channels',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDXi1FXpb28tSPvQjRjHYvrLwmHq9fov8_u49DdraF4u46VEHq9IFKSbc9QGzb6yxoxH6stWMVVvuE5hYPCnMGvA-G69rgngLLHelYKAK7ZHwDsfT3exV3FjRM-YqfWjAp8KUI7TnOSC13_9uAxubg-GVLjUrYW3JV5ynig_utqI9-LdSUPltt8ygHuMzMB2ivw5hP0xbZU9owe9bN-Q2YS6KwX4B4FOdjM1C825RbFjwa0ySnEKMqejg',
    alt: 'Just Chatting Cover',
  },
  {
    name: 'Music',
    badge: 'Creative',
    viewers: '85K',
    liveChannels: '1.2K Live Channels',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD7McvLEmuywt5MlRTxhDNVJrsyYOXX87ydwATAq7iLneVQ4GvIZjfmI3sPKY4j4QkCzwDosd827aF5pxNBrY6zZtlmoMYQibKJulkWItIEegRxlK84iOOEzIvWoR5YU58OoELww63fOFrEGEQoRczirzwJdgnL1vWtkSRdM_AG9KpD0SA-BNutJzOqB-oW_FYcfk4uuRJokF7OJaSyQgyG_-E30UhOVLRE3PQYtvzxW7nUmi5Daf2Tmg',
    alt: 'Music Cover',
  },
  {
    name: 'Software & Tech',
    badge: 'Tech',
    viewers: '42K',
    liveChannels: '840 Live Channels',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuALyNyxp-PEB3a3dx2mZc435K-1ZRdGH2bv2xEmBIFd-FWW7VVEGLvRZJtwdQtcOfKNy5dionhRLeCKwDqDB3L7CQtA1Rr56Qy7IP1u8aHIeVsugimNOkhcPqVp6Q4bPJYU4BEC261PV0ito7OCKv18_IagwtFbBUChTRTecQ_m6WXo_zRZj4dG9P0vqeM_2EtIkeJ4RYh0lwIr_WKOe2OhNXWBdvKiV2C31HW4RRrEG7eexaC0qeqGw',
    alt: 'Technology Cover',
  },
  {
    name: 'Esports Tournaments',
    badge: 'Events',
    viewers: '210K',
    liveChannels: '320 Live Channels',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCT4u_ckKYG3vDqwaF31s0nKtGpf7O4IlhEFykK0b5LuNSmngR6FbKvttC12NbRigRsgdRSBZg0fqAKojpJsiUVh1R-AixyoqZDz-yUhZNeUV8GUSECIIi3o0RJtMr68nveqxy4ji7gPAumiLanGlWiX0xtBGACB71SWXqk0E6Coj_k1ALXWKMbrh99di6F5YSFEdg2Zmh3Idsh7aBVmkdbGvgCZ_iq5pr4_YeDEigx5BwpntYXGPYclg',
    alt: 'Esports Cover',
  },
];

// Icon per badge — falls back to a generic grid icon for any badge value
// that shows up later without a mapping here, so a new category never
// renders without an icon.
const BADGE_ICONS: Record<string, LucideIcon> = {
  Gaming: Gamepad2,
  IRL: Users,
  Music: Music2,
  Creative: Palette,
  Tech: Cpu,
  Events: Trophy,
};

// Filters are derived from the badges actually present in the data, instead
// of a hand-typed list — the previous static list ('Games', 'Music') didn't
// match the real badge values ('Gaming' had no matching filter at all), so
// clicking most of them silently filtered nothing. This also means a new
// category with a new badge gets a working filter automatically.
const FILTER_ALL = 'All Categories';

export default function Categories() {
  const [activeFilter, setActiveFilter] = useState(FILTER_ALL);

  const filters = useMemo(
    () => [FILTER_ALL, ...Array.from(new Set(categories.map((c) => c.badge)))],
    [],
  );

  const visibleCategories = useMemo(
    () =>
      activeFilter === FILTER_ALL ? categories : categories.filter((c) => c.badge === activeFilter),
    [activeFilter],
  );

  return (
    <div className="mx-auto w-full max-w-[1920px] flex-1 p-md pt-16 md:p-lg md:pt-0 lg:p-xl">
      <h1 className="mb-lg text-display-lg-mobile font-display-lg-mobile text-on-surface md:text-display-lg md:font-display-lg">
        Categories
      </h1>

      {/* Filter chips — derived from real badge values, see FILTER note above */}
      <div className="no-scrollbar mb-lg flex gap-sm overflow-x-auto pb-2">
        {filters.map((filter) => {
          const isActive = activeFilter === filter;
          const Icon = filter === FILTER_ALL ? LayoutGrid : (BADGE_ICONS[filter] ?? LayoutGrid);
          return (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              aria-pressed={isActive}
              className={`flex shrink-0 items-center gap-xs whitespace-nowrap rounded-full border px-4 py-1.5 text-label-md font-label-md transition-colors ${
                isActive
                  ? 'border-transparent bg-primary-container text-on-primary-container font-semibold'
                  : 'border-outline-variant/30 bg-surface text-on-surface-variant hover:border-outline-variant hover:text-on-surface'
              }`}
            >
              <Icon className="h-4 w-4" />
              {filter}
            </button>
          );
        })}
      </div>

      {/* Category grid */}
      {visibleCategories.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-outline-variant py-2xl text-center">
          <LayoutGrid className="h-8 w-8 text-outline" />
          <p className="text-body-md font-body-md text-on-surface-variant">
            No categories in &#34;{activeFilter}&#34; yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-md sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleCategories.map((category, i) => (
            <div
              key={category.name}
              className="motion-safe:animate-[fade-in-up_400ms_ease-out_backwards]"
              style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
            >
              <CategoryCard
                name={category.name}
                badge={category.badge}
                image={category.image}
                viewers={category.viewers}
                liveChannels={category.liveChannels}
                alt={category.alt}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
