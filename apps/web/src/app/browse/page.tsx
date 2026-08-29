'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import StreamCard, { StreamCardProps } from '@/components/StreamCard';
import {
  ChevronDown,
  Radio,
  LayoutGrid,
  Eye,
  Clock,
  Sparkles,
  Check,
  ArrowUpDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type FilterId = 'all' | 'live' | 'categories' | 'most-viewed' | 'recent' | 'recommended';

const FILTERS: { id: FilterId; label: string; icon?: LucideIcon; liveDot?: boolean }[] = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live Now', liveDot: true },
  { id: 'categories', label: 'Categories', icon: LayoutGrid },
  { id: 'most-viewed', label: 'Most Viewed', icon: Eye },
  { id: 'recent', label: 'Recently Started', icon: Clock },
  { id: 'recommended', label: 'Recommended', icon: Sparkles },
];

// Only 'all' and 'live' have real data behind them today (isLive is the only
// field on StreamCardProps that supports filtering). The rest are wired up
// as soon as the API returns category/recency/recommendation data.
const FILTERABLE: FilterId[] = ['all', 'live'];

type SortKey = 'viewers-desc' | 'viewers-asc' | 'alpha';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'viewers-desc', label: 'Most Viewers' },
  { key: 'viewers-asc', label: 'Fewest Viewers' },
  { key: 'alpha', label: 'A–Z' },
];

const STREAM_CARDS: StreamCardProps[] = [
  {
    id: 1,
    title: "Grand Finals World Championship '24",
    streamerName: 'NinjaGamerX',
    category: 'Cyber Strike: Evolution',
    viewerCount: 45.2,
    isLive: true,
    thumbnailUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDfJDdJiEH4DlSRYrkaO9GI8VMffKGVgl13WPbIzof2QAWvqY7h_ltKKC-BLp90pTq4e6tMVxpGWczR2P20-AwA0rGhL51FdHqGicSiwVDZ038NT821WW1JycZJ8S8WuVcOCwdvQ3OQw2pKhBCmyU2FYx6yiXwPZHPbOV9GTYM7TbLubWY0_muTIqGS4KKM2YXdex4BEVzN4FTMyIm9dgoPzuqiGwBwVspJ4xJBc1o_FA6ugSC9t1fDnA',
    thumbnailAlt:
      'A highly detailed in-game screenshot of a fast-paced futuristic sci-fi first person shooter. The scene features bright neon laser fire, complex industrial metal architecture, and a dynamic motion blur effect conveying intense action. The lighting is dramatic, heavily contrasting deep space blacks with vibrant cyan and magenta particle effects.',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAKYJ18qkHOAoRpAPa-dJDMmSHYaS3E-b9izzj9T_wgfMc0-HDQPeqhGd8e7ZQ1YVaALdwt662wei99gjHaBNzGyNti2BdcFf8MhLBdh5vDCnKJJgfOl0sTtNd2m5sxYAqeFxxyhxjx62l1aNXiBO5ND789Vh94PIlvjQB98ZWxP9wBSpFgzPlzj1Kk2TqldMciqE5JB68kNybcJgxLLkJf9nNKDUWwnlcmc7hJPJ2FtX-7SYoL2zJb1g',
    avatarAlt:
      'Close up portrait of a young male streamer with colorful dyed hair wearing a premium headset. He has an intense, focused expression. The room is dark with vibrant RGB lighting reflecting off his face, emphasizing a modern tech and gaming aesthetic.',
  },
  {
    id: 2,
    title: 'Building a Next.js App from Scratch | Day 4',
    streamerName: 'CodeWithSarah',
    category: 'Software & Game Dev',
    viewerCount: 12.8,
    isLive: true,
    thumbnailUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCFB64sypYwHF3nqkB096n0kkbDzcS87W1hsz6FOa48oQdOf9diJaU1OdvZqegpzS8HSQmzCB9s81ralphkxlFnN3acr1JxS6-NY0Q8MsoPkogQRE1uJlKvN_lRbIKuC0syTzMvMH5saWbfem0z3dwhKmB_Xcae4rpp3CXkuCsGILoaicNsOTcMXbfBc0hVhl7iFYJ2lXoYaaWCxsMMj-YYHdJwLaG7uJtJrkXNb4JmscTY9WikeMrifA',
    thumbnailAlt:
      'A clean, minimalist digital interface showing complex code being written in a dark theme IDE. Bright syntax highlighting in neon greens, pinks, and yellows pops against the deep charcoal background. The composition suggests professional software development in a focused, high-tech environment.',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCZL9klTBp4DVxe_IA9uNqkOV4qBpe2AMTMv_TS8eefRNwdfuV3uJyCh2OeBk-m5Cv1vQyts0-0_UXUlezz2GKcO56WLXNvqMc0KLqyD5PMOjJDTkXWftZP_sh-6ax9oKdB4D05zRl-1FWYVmynNmpEN03fjghNCVDZAkrGpPKFreR0kdTQ1gNYGu7eNF-we94V0g3yIMHLsDVI_gFY0Q7y9aKpPzc2qivptWtXa9f822qIvFK0eopYyg',
    avatarAlt:
      'A portrait of a female software developer in a dimly lit, cozy room. She is looking at multiple monitors displaying lines of code. Warm amber ambient lighting contrasts with the cool blue glow of the screens, creating an inviting tech aesthetic.',
  },
  {
    id: 3,
    title: 'Elden Quest: The Final Boss Strategy',
    streamerName: 'RPG_Master',
    category: 'Elden Quest V',
    viewerCount: 8.4,
    isLive: true,
    thumbnailUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuApV54TLzDUvGpiPk_NglddXCRTUu3DNPbeQ0ac2Ia9MqQviVoNlt6IELoxn2XAalqafEZnF3XQC6GR6RRk-j8eKtfFB5WJaHz9uDwZXsbp3-FAgTIjJuBArl6e-QIGDvAWPbH8qNFXTtpnMGHExIzB_lH-zr2SX-Zu5le5IZ4LANGsMbcYGsBMa_PBWShooYnZwWPTBFIeSYNoR-DCFs6tQsN-FC_LQ3v2SuCq5PojOCotICKeIbBypw',
    thumbnailAlt:
      'A sweeping fantasy landscape from an RPG game. Majestic glowing ruins float above a dense, dark forest. Magical ethereal light beams down from a starry sky, illuminating the lush foliage. The aesthetic is epic, highly detailed, and relies on deep blues and vibrant mystical purples.',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAVX_CsTxv4N_tft0qzrqI2RsFUUgImW5qqYMkYdPAI_kczbb8UdrPTIR6XOc7tBOUkWl1YPY15gxxgH4MwTGVdPju-9KQJCZvS-S7JfYyjN5a_Qerkw4w3SFXyXvKjgax8DQOZ3qIXv_yPU8pOPidE9ck--kWS6aeVD2nj8p2T6cmeIQyokXoxUIBTCP6AxdCl5kA5DqRe6TcDgnkAUNniz094jNZ2-I0EgneQSydVOCKs0CBY4EaXwA',
    avatarAlt:
      'A stylized minimalist avatar showing an elven character face in profile. The design is sleek and uses vector graphic style shading with a palette of deep forest greens and silver tones, maintaining the dark-first UI aesthetic of the platform.',
  },
  {
    id: 4,
    title: 'Tech Talk: The Future of AI in Gaming',
    streamerName: 'The Daily Cast',
    category: 'Just Chatting',
    viewerCount: 32.1,
    isLive: true,
    thumbnailUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDi19g8sF9jvFu-5rMOb-CmknfU5bFQqmbSYVEHMxyr0NIVXvJy7F39e_8v3xUzpBXh_gXq9o_Jb0dEhMXGil0KrRvwp_al3Du26zRT_DLgCKSfsVCKt36VmRmuOW249acoZKJJ_RoVEYQL9uP0DMQmtMV_06lwn2Sli1xZ4uYRfTmVXq2miIsR48pCMFnP6AfT1Zzp11C-srbnry5rDD6u1vb-42wi8TMMNQjU80EU1GFTqM-ppu_o7g',
    thumbnailAlt:
      'A wide angle shot of a professional podcast studio. Two hosts are seated across from each other with high-end microphones. The room is modern, featuring acoustic foam panels and sleek glassmorphic furniture, illuminated by soft LED strip lighting in a predominantly dark setting.',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBJH_tj6HEGaVEFgPYGl712o3trhusYMpcUxJzabV_Pab6OX_CcXjM43EkNXGRSGyMqM76il83u8tRMuJ-V_UnXwIGl87usCZSD3K3xThtFw3Ud_DHGuM16jJ1P1QkztZt8tHPC7LQOrFJ430junNNAz8U8_Aj-OpWmx66FbPkDtR1BZuPBe-0pMNF39KtRvl1EE9QhzNyVi5zpgbm-y5WkUolKHEufMAjyFaoZlfSkIUFGWqkWDmJJyg',
    avatarAlt:
      'A clean, modern logo for a podcast channel featuring an abstract microphone design intertwined with audio waves. The logo uses a stark white design against a deep charcoal background, exuding professional reliability and tech focus.',
  },
  {
    id: 5,
    title: 'Friday Night Synthwave Mix [LIVE DJ]',
    streamerName: 'DJ_Neon',
    category: 'Music & Performing Arts',
    viewerCount: 5.6,
    isLive: true,
    thumbnailUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuArXcJ9WSBMkt-pxcQxkV6ateA0HyD_QTC_4bY4gssQSq9E9ag2i7wjUbagMFj4wUv7R_DHSC8Tezfby-DIhPIanFW3N40S2W8F3EP8O-sWwmHxOevS_D3bMVqNAMnaQLu8NgZO75y82XMBWz2nrx_hZISuCFEfSt8rB-ciCMxRPcLeFlRF3FCwhs3bbqZQ0ivAfIeaVB_v9QE21cxE4TycAL5CIGRWwYavTlE9PomqiX4RGPXvLx4y9w',
    thumbnailAlt:
      'An energetic view from a DJ booth during a live electronic music performance. The crowd is a sea of silhouettes illuminated by intense laser lights in primary purple and cyan. The visual hierarchy focuses on the intricate DJ equipment in the foreground against the dynamic concert background.',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA0Qx5AVHriktzKPDOQlg18dDlLAs7HclB5n7dsJd_bRSaYqaTHoDKbACZ2DbtcZcxg-M7F4KVmJ6IhfusWvv6YfJABEF-CzhAiUe9IKyplgkzo2db3TN8fvMY8V9V6DsUJSKvbriue04LI-UZQCq3fm6CSfF4_gLLp6hjiwxdUQkNBtdw3C92nG-pSdra2SVJCVBNIQcMB_diyV_mBy4mEwIGhABwit4byQZ0hOTGfCSRcI2OTPjpezA',
    avatarAlt:
      'A stylized portrait of a DJ wearing oversized headphones, lit dramatically from below with neon pink light. The background is pitch black, creating a high-contrast, energetic live music aesthetic suitable for a modern streaming platform.',
  },
  {
    id: 6,
    title: 'LCK Summer Split Playoffs',
    streamerName: 'OfficialEsports',
    category: 'League of Legends',
    viewerCount: 112,
    isLive: true,
    thumbnailUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuACXBRpHvHCy0HQ63pp7WypcNdf8V6-3nRJfhz9Cn34wPWf6NOj_cjIvx-NWKdkOtW73NDZowtoWI1CGPjPYWWXHbczVHpoHY-aQZUB7PhOiak5fsSaYXSVwkeRqAWqLyjSGtg3B8mcwTtd0ZH0BVbNEo5cCjMbb9vkwBRiyhE_Q6DRS7Bni82maL83dJjOP2ddPnpvePRGpn3qAghn5dcHku5-N42bVyg4DUEcJEBmCnoUmO3a2V_s3Q',
    thumbnailAlt:
      'A top-down tactical map view from a popular competitive MOBA game. The interface is sleek and dark, with vibrant colorful icons representing player characters moving across the terrain. Actionable UI elements are highlighted in energetic high-chroma colors against the dark forest map background.',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCRJfsSbj-TfNslSeNti7N789B2w2qU2t70kjtx5jYcby6uhmuPUTD1fLywNtfFZgUGg-OZbi4cV1p2b16H7wYTJkxD4KSwHe_-mHRgeKjO3cp2MC65Cs-MRWY15XmRwIEoUjf2LQ63oCH496Yup21fPEBizT5wCyb_nyERVUnxX6wjiteYmPuxyIdIzv74HDEZkRJiqnuGen9DxhwsIYip_U3koFjF4AP61HE4nJmNuUyJoqg_EdXdJQ',
    avatarAlt:
      'An esports team logo featuring a stylized geometric wolf head in stark white and primary purple on a dark background. The design implies precision, aggression, and professional gaming tier performance.',
  },
];

export default function Browse() {
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [sortBy, setSortBy] = useState<SortKey>('viewers-desc');
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close the sort dropdown on outside click or Escape.
  useEffect(() => {
    if (!sortOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSortOpen(false);
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [sortOpen]);

  const liveCount = useMemo(() => STREAM_CARDS.filter((c) => c.isLive).length, []);

  const visibleCards = useMemo(() => {
    const filtered = activeFilter === 'live' ? STREAM_CARDS.filter((c) => c.isLive) : STREAM_CARDS;

    return [...filtered].sort((a, b) => {
      if (sortBy === 'alpha') return a.title.localeCompare(b.title);
      if (sortBy === 'viewers-asc') return a.viewerCount - b.viewerCount;
      return b.viewerCount - a.viewerCount;
    });
  }, [activeFilter, sortBy]);

  const currentSortLabel = SORT_OPTIONS.find((o) => o.key === sortBy)?.label;

  return (
    <div className="mx-auto w-full max-w-[1920px] flex-1 p-md pt-16 md:p-lg md:pt-0 lg:p-xl">
      {/* Header */}
      <div className="mb-lg flex flex-col gap-md justify-between md:mb-xl md:flex-row md:items-end">
        <div>
          <h1 className="mb-xs  text-headline-lg-mobile font-headline-lg-mobile text-on-surface md:text-headline-lg md:font-headline-lg">
            Browse Streams
          </h1>
          <p className="flex items-center gap-xs text-body-md font-body-md text-on-surface-variant">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-error" />
            </span>
            {liveCount} streams live now
          </p>
        </div>

        {/* Sort dropdown */}
        <div ref={sortRef} className="relative w-full md:w-auto">
          <button
            type="button"
            onClick={() => setSortOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={sortOpen}
            className="flex w-full items-center justify-between gap-sm rounded-lg border border-outline-variant bg-surface px-md py-sm text-body-sm font-body-sm transition-colors hover:border-primary md:w-56"
          >
            <span className="flex items-center gap-xs text-on-surface">
              <ArrowUpDown className="h-3.5 w-3.5 text-on-surface-variant" />
              Sort: <strong className="font-semibold">{currentSortLabel}</strong>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-on-surface-variant transition-transform ${sortOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {sortOpen && (
            <ul
              role="listbox"
              className="absolute right-0 z-10 mt-xs w-full min-w-[12rem] overflow-hidden rounded-lg border border-outline-variant bg-surface shadow-lg md:w-56"
            >
              {SORT_OPTIONS.map((option) => (
                <li key={option.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={sortBy === option.key}
                    onClick={() => {
                      setSortBy(option.key);
                      setSortOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-md py-sm text-left text-body-sm font-body-sm text-on-surface transition-colors hover:bg-surface-variant"
                  >
                    {option.label}
                    {sortBy === option.key && <Check className="h-4 w-4 text-primary" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="no-scrollbar mb-lg w-full overflow-x-auto pb-sm">
        <div className="flex min-w-max items-center gap-sm">
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.id;
            const isFilterable = FILTERABLE.includes(filter.id);
            const Icon = filter.icon;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => isFilterable && setActiveFilter(filter.id)}
                title={isFilterable ? undefined : 'Coming soon'}
                className={`flex items-center gap-xs rounded-full px-md py-sm text-label-md font-label-md transition-colors ${
                  isActive
                    ? 'bg-primary-container font-semibold tracking-wide text-on-primary-container'
                    : 'border border-outline-variant bg-transparent text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
                } ${!isFilterable ? 'opacity-60' : ''}`}
              >
                {filter.liveDot && <span className="h-2 w-2 rounded-full bg-error" />}
                {Icon && <Icon className="h-4 w-4" />}
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stream grid */}
      {visibleCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-outline-variant py-2xl text-center">
          <Radio className="h-8 w-8 text-outline" />
          <p className="text-body-md font-body-md text-on-surface-variant">
            Nothing live right now — check back soon.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-layout-gutter sm:grid-cols-2 md:gap-lg lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {visibleCards.map((stream, i) => (
            <div
              key={stream.id}
              className="motion-safe:animate-[fade-in-up_400ms_ease-out_backwards]"
              style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
            >
              <StreamCard
                id={stream.id}
                title={stream.title}
                streamerName={stream.streamerName}
                category={stream.category}
                viewerCount={stream.viewerCount}
                thumbnailUrl={stream.thumbnailUrl}
                thumbnailAlt={stream.thumbnailAlt}
                avatarUrl={stream.avatarUrl}
                avatarAlt={stream.avatarAlt}
                isLive={stream.isLive}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
