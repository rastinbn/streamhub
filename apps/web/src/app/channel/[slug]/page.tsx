'use client';

import { useState } from 'react';
import Image from 'next/image';
import { BadgeCheck, Heart, Bell, Eye, VideoOff, Share2 } from 'lucide-react';

type Tab = 'Home' | 'About' | 'Videos' | 'Clips';
const TABS: Tab[] = ['Home', 'About', 'Videos', 'Clips'];

type VideoCard = {
  id: number;
  title: string;
  category: string;
  duration: string;
  views: string;
  postedAgo: string;
  thumbnailUrl: string;
  thumbnailAlt: string;
  featured?: boolean;
};

const CHANNEL = {
  name: 'CodeNinja',
  followers: '500K',
  bio: 'Building the future of streaming. Live coding, architecture reviews, and high-performance system design.',
  isLive: false,
  avatarUrl:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCFsuI4LqAQoMGT0otZ_ZHVHiYArmmN_YqgQQZu12Cj0BMuxl_1AOv33OyjLMocco6RhRESzwSV6S173isKdWeLTo-wHItzFi5dCebjv2R50neqkKF876hTYj7Mfk74cNnsUs4n6MH2zkPx9ijeTRYEo8r66-Imu3vLFXAbu3ntgoUnbvCYWSQ2kpyyS1HEcL2hg0VcQf6QgR2fNRI98vgo-rBd9IMyQCh16zdG_R69llwsjzHnC0XsEg',
  bannerUrl:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCO_5IgwAKmTmzPhHE0iCsRzYfcAupvDUcYxz4-TFMGrMSrCDUBnkswHfc43Mf1f3Aiq0gAGlVvIdOicX6CLraaElGqNzRKECM9zJfn3GjrB3w_O1X07JzDSOrO1LLwn40e12kJD776xk2xTjqLQVVeV-kREaT-bbQdMq2scfw2z9uTRbzDSnN3No8QLclT80N3iHf31f7aR_mGrwl4uiRcZx_PG4Gmfq9PORn5WWaf0p1ifgvVBN4EiA',
  bannerAlt:
    "A vast, atmospheric abstract digital landscape featuring glowing, generative geometric shapes against a deep, dark minimalist background, fitting for a top-tier software developer's streaming channel banner.",
};

const RECENT_BROADCASTS: VideoCard[] = [
  {
    id: 1,
    title: 'Building a Scalable Microservices Architecture from Scratch - Part 4',
    category: 'Software & Game Development',
    duration: '3:45:12',
    views: '12.4K',
    postedAgo: '2 days ago',
    thumbnailUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAQH_fxAbs2pRfwrFi3HoQVxuMwNPvepWHilVZbvcg-QaWtCziFi12Qyu9RlNHcMMgzcDyMGEjjA_gcHezM9fFLJbbZUOtA2BiQRI3T3TveEZP7Lxo643mx_l4xtjQe4VgP_HXjy8iPb_JSCBCsFU7me6lQKsMP4gLg2x2iFsu3tzWPiht3t_NcxaZSQCZzwG0dw0AMflvdCJHZVrl0ggOKhfgW8JgTo_DEbrsV2EiGC6tNxAmsRldYdA',
    thumbnailAlt:
      'A detailed, high-contrast screenshot of a dark-mode IDE with elegantly formatted source code and vivid syntax highlighting in cyan, purple, and green, on a near-black background.',
    featured: true,
  },
  {
    id: 2,
    title: 'React Server Components Deep Dive',
    category: 'Web Development',
    duration: '1:22:05',
    views: '8.2K',
    postedAgo: '4 days ago',
    thumbnailUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDjfZpvC5x1DN-hvlSGaQNV16IAMijpdDCEeWGEJHXyL0zNnJCOq7x7igy508fvWJu6OO3o-Auj4NikXQn_HYjgtFtEUvdpDutKc6G8rEVehTt6w3FBIr854fzqmXFkeUC7hbvZgWfAjIbq7wbeyUBZRVfG2dwAX8YK1F00Z5wuAGJMH4nZ9SmjqiAMvC2CDTnPPcxp_ymQvoGQuUjJlN7acXT6UYgUOoMWB7grOclz8C5sYjpZaTXAEA',
    thumbnailAlt:
      'Abstract data flows as glowing streams of light traveling through dark server architecture, deep blacks with cyan accents.',
  },
  {
    id: 3,
    title: 'Live UI/UX Review: Roasting your Portfolios',
    category: 'Design',
    duration: '2:10:44',
    views: '15K',
    postedAgo: '1 week ago',
    thumbnailUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAWfc5cQzfLfVYpNHx42-svJtIfeehEXbh9p0jlxvz93IfQZhv6D7EXxuTMuU8aa2U7jSxZ5eBLdbKH5vdiv1659IurCjb-ukT8V_PyyYns0V6EkGbWW3OCM1Jp6vVdBKA1jpS201YrKlS9SKVGKoB_Aiu-2O7gG0JlSItVWeqa442S6D7FCZ0KUtJT072KViMZY--2kkdqQfAOI2yX0AAtxPY85wngVCa9rZwr8ffpWmW1dR4alslncA',
    thumbnailAlt:
      'A professional UI design mockup on an angled dark-themed monitor with glassmorphic panels and purple accent highlights.',
  },
];

export default function ChannelPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Home');
  const [isFollowing, setIsFollowing] = useState(false);
  const [notifyOn, setNotifyOn] = useState(false);

  return (
    <div className="relative bg-surface-container-lowest">
      <div className="relative h-48 w-full overflow-hidden border-b border-outline-variant/20 bg-surface-container md:h-64">
        <Image
          src={CHANNEL.bannerUrl}
          alt={CHANNEL.bannerAlt}
          fill
          priority
          className="object-cover opacity-80"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-transparent to-transparent opacity-90" />
      </div>


      <div className="relative z-10 mx-auto -mt-44 flex max-w-7xl flex-col gap-md border-b border-outline-variant/20 px-layout-gutter pb-md sm:-mt-36 sm:flex-row sm:items-end sm:justify-between md:px-layout-margin">
        <div className="flex items-end gap-md sm:gap-lg">
          <div className="relative h-24 w-24 shrink-0 rounded-full bg-surface-container-lowest p-1 shadow-lg ring-2 ring-outline-variant/50 sm:h-32 sm:w-32">
            <Image
              src={CHANNEL.avatarUrl}
              alt={`${CHANNEL.name} avatar`}
              fill
              className="rounded-full object-cover grayscale-[20%]"
            />
            <span
              aria-label={CHANNEL.isLive ? 'Live' : 'Offline'}
              className="absolute bottom-1 right-1 h-5 w-5 rounded-full border-4 border-surface-container-lowest bg-surface-variant sm:h-6 sm:w-6"
            />
          </div>

          <div className="pb-1 sm:pb-2">
            <div className="flex items-center gap-xs">
              <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:font-headline-lg md:text-headline-lg">
                {CHANNEL.name}
              </h1>
              <BadgeCheck className="h-5 w-5 fill-primary text-surface" />
            </div>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              {CHANNEL.followers} Followers
            </p>
            <p className="mt-sm hidden max-w-xl font-body-md text-body-md text-on-surface sm:block">
              {CHANNEL.bio}
            </p>
          </div>
        </div>


        <div className="mt-sm flex w-full items-center gap-sm sm:mt-0 sm:w-auto sm:pb-2">
          <button
            type="button"
            onClick={() => setIsFollowing((v) => !v)}
            aria-pressed={isFollowing}
            className={`flex flex-1 items-center justify-center gap-xs rounded-DEFAULT px-lg py-sm text-label-md font-label-md transition-colors duration-150 active:scale-95 sm:flex-none ${
              isFollowing
                ? 'border border-outline-variant/30 bg-surface-container text-on-surface hover:bg-surface-container-high'
                : 'bg-primary text-on-primary shadow-md shadow-primary/20 hover:bg-primary-fixed'
            }`}
          >
            <Heart className="h-[18px] w-[18px]" fill={isFollowing ? 'currentColor' : 'none'} />
            {isFollowing ? 'Following' : 'Follow'}
          </button>

          <button
            type="button"
            onClick={() => setNotifyOn((v) => !v)}
            aria-pressed={notifyOn}
            aria-label={notifyOn ? 'Turn off notifications' : 'Turn on notifications'}
            className={`flex h-10 w-10 items-center justify-center rounded-DEFAULT border border-outline-variant/30 p-sm transition-colors duration-150 active:scale-95 ${
              notifyOn
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <Bell className="h-5 w-5" fill={notifyOn ? 'currentColor' : 'none'} />
          </button>


          <div className="ml-xs flex h-8 items-center gap-xs border-l border-outline-variant/30 pl-sm">
            <button
              type="button"
              aria-label="Share channel"
              className="p-1 text-on-surface-variant transition-colors hover:text-primary"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <p className="block px-layout-gutter pt-sm font-body-md text-body-md text-on-surface sm:hidden">
        {CHANNEL.bio}
      </p>

      <div className="no-scrollbar mx-auto mt-md max-w-7xl overflow-x-auto border-b border-outline-variant/20 px-layout-gutter sm:mt-lg md:px-layout-margin">
        <ul className="flex min-w-max gap-lg">
          {TABS.map((tab) => (
            <li key={tab}>
              <button
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative cursor-pointer py-md text-label-md font-label-md transition-colors ${
                  activeTab === tab
                    ? "text-primary after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary after:content-['']"
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-auto max-w-7xl px-layout-gutter py-lg sm:py-xl md:px-layout-margin">
        {activeTab !== 'Home' ? (
          <div className="flex flex-col items-center justify-center gap-sm rounded-xl border border-dashed border-outline-variant py-2xl text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              {activeTab} isn&#39;t wired up yet — no data source for it so far.
            </p>
          </div>
        ) : (
          <>
            {!CHANNEL.isLive && (
              <div className="group relative mb-xl flex flex-col items-center overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container p-lg text-center sm:p-xl">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
                <div className="relative mb-md flex h-16 w-16 items-center justify-center rounded-full border border-outline-variant/50 bg-surface-variant sm:h-20 sm:w-20">
                  <VideoOff className="h-8 w-8 text-outline sm:h-10 sm:w-10" />
                </div>
                <h2 className="mb-xs font-headline-md text-headline-md text-on-surface">
                  {CHANNEL.name} is currently offline
                </h2>
                <p className="mx-auto mb-lg max-w-md font-body-md text-body-md text-on-surface-variant">
                  Follow to get notified when {CHANNEL.name} goes live with new high-performance
                  system design sessions!
                </p>
                <button
                  type="button"
                  onClick={() => setNotifyOn(true)}
                  className="flex items-center gap-sm rounded-DEFAULT bg-primary-container px-lg py-sm text-label-md font-label-md text-on-primary-container transition-colors duration-150 hover:bg-primary-fixed active:scale-95"
                >
                  <Bell className="h-[18px] w-[18px]" fill={notifyOn ? 'currentColor' : 'none'} />
                  {notifyOn ? 'Notifications on' : 'Turn on Notifications'}
                </button>
              </div>
            )}

            <div>
              <h3 className="mb-md font-headline-md text-headline-md text-on-surface">
                Recent Broadcasts
              </h3>
              <div className="grid grid-cols-1 gap-md md:grid-cols-2 lg:grid-cols-3 lg:gap-lg">
                {RECENT_BROADCASTS.map((video) => (
                  <div
                    key={video.id}
                    className={`group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface transition-all hover:border-outline-variant/60 hover:bg-surface-container-high ${
                      video.featured ? 'md:col-span-2 lg:col-span-2' : ''
                    }`}
                  >
                    <div
                      className={`relative overflow-hidden bg-surface-container-highest ${
                        video.featured ? 'aspect-[21/9] sm:aspect-video' : 'aspect-video'
                      }`}
                    >
                      <Image
                        src={video.thumbnailUrl}
                        alt={video.thumbnailAlt}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      />
                      <div className="absolute bottom-sm left-sm rounded border border-outline-variant/30 bg-background/90 px-2 py-1 backdrop-blur-sm">
                        <span className="font-label-sm text-label-sm text-on-surface">
                          {video.duration}
                        </span>
                      </div>
                      <div className="absolute top-sm right-sm flex items-center gap-1 rounded-sm border border-outline-variant/30 bg-surface-variant/90 px-2 py-1 backdrop-blur-sm">
                        <Eye className="h-3.5 w-3.5 text-on-surface-variant" />
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          {video.views}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col justify-between p-md">
                      <div>
                        <h4
                          className={`line-clamp-2 text-on-surface transition-colors group-hover:text-primary ${
                            video.featured
                              ? 'font-body-lg text-body-lg'
                              : 'font-body-md text-body-md'
                          }`}
                        >
                          {video.title}
                        </h4>
                        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                          {video.category}
                        </p>
                      </div>
                      <div className="mt-sm flex items-center justify-between">
                        <span className="font-label-sm text-label-sm text-outline">
                          {video.postedAgo}
                        </span>
                        {!video.featured && (
                          <span className="font-label-sm text-label-sm text-on-surface-variant">
                            {video.views} views
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
