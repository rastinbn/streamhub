'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import HeroSection, { HeroData } from '@/components/home/HeroSection';
import HomeStreamCard, {
  HomeStreamCardData,
  getResponsiveClass,
} from '@/components/home/HomeStreamCard';

const HERO: HeroData = {
  title: 'Pro Tournament Finals: Group Stage Day 1',
  streamerName: 'StellarGaming',
  category: 'Valorant',
  tags: ['FPS', 'Competitive', 'Drops'],
  viewerCount: '25.4K',
  thumbnailUrl:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDlMp5ZXNR20d9IRJy4GD64fFT1-ZgL_ePf_XDGkuHDfvudIJ9kBfB-i9Gfu1Abxx9QpUj8XPSnMIUusbTNjAmdV1U9tVvHgyAyFw9-b3UTanjgcvBnDPihB1La_eisiu0FUK1xYobElR2iiXkIS5056TYmIbDSRGrjH5CHQp1Ua8hl_6oi6Mahu8ZE-Ij8Y9SA-X2snF9R1rn9hrYjIsJETZC2PJKurvyhR0pwecwAKktOWwxyYasfWA',
  thumbnailAlt:
    'A high-octane esports tournament final match in a massive stadium with neon lasers and dramatic volumetric smoke.',
  avatarUrl:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDBY3XXk5g9KeNZXLQ-l9Tuh6zIw24cCf5sFYTA9-iUdXFmxA5l8hHwna5XtM29k7a6UIqdxJQSJwWqgDOQPbLdNirXLf4CaIfAe2LTdcbzd8FaB8VoYH0vHy4EPAfQ7acxn3b2WzCZXRQyqW5MNF9hA_QE43Nzt9OPQaPYRhpWY_BNRLJ7xX3R-g7SJdMf9CiaOAWtR6-63REqR8rDI9GN5fsexc6j1mbrAtg83bAe2DCxmk9Bxdx9Ow',
  avatarAlt: 'A close-up portrait of a professional gamer with a focused expression, wearing a premium gaming headset.',
};

const STREAMS: HomeStreamCardData[] = [
  {
    id: '1',
    title: 'Late Night City Drifts - Rank Push!',
    streamerName: 'TurboRacer99',
    category: 'Sim Racing',
    viewerCount: '12.1K',
    thumbnailUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC3vDgQwC0YEi8R1TtVbt8l32-xIukQsthrdW4uK21NdhXyMMOPk0zru57tAOPN8nqxFLcg8AhYJptRjicBxnU444HFDdS9A0XNOOeRfwqe7i0SM00nG-oqF10gYHgmuZGjBbnOoXAfcIxRQo5UbQvkVKUDJtLtL7rcQPOSQcaUl85JYcJY-uWits_lm0GYY_9ORmNaJiAIJMdUDiSGUPYGV9JrgHSAxOyK0cFE4j-IyhW9DStcQXHlmA',
    thumbnailAlt: 'A dynamic screenshot of a high-speed racing game with neon-lit city circuit at night.',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC2YyIPbmoWFreRwNEZDWh_seVDryxgSgsL3xprqNEi0BpdnRSyx0vRVJ3eNbFEVa5b3D0EvKOxoe_l1ZzbW6rXGqNrYabq6F-RSEH_BHma8Rk4oiRU1stzFXb1OfV-PoHSt5uj8-QcdLZW7oUcH3tJtJLydRwHoRM93kuqzpldD6WIE5ezNOYyEdruuC3z__DirnIhAm_YdxSazC6UiccAuu-ezCkA6JF7gYeHeqoJzmjxXlO_e28bmQ',
    avatarAlt: 'A portrait of an energetic streamer wearing a racing helmet visor half-open.',
    showFrom: 'all',
  },
  {
    id: '2',
    title: 'Chill vibes & Viewer Games',
    streamerName: 'CozyGamerGirl',
    category: 'Just Chatting',
    viewerCount: '8.5K',
    thumbnailUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCYKPcTcVgfjmKwWHgbve25i8zbabMfmj-7mszqw8of_62AQc00UVc4Rnv5Rtjrqo9pT7WgtdghL3CuC4CL-ED2z1MvuUfWEnzxzH5beMuvjZAN6uaAqputsKZW-IabKxT3FXQo_7JgAzkg9dzJSoK7TGt-Z3MhQOv2GkI5G131SVsTbkNRnO1teDgUaxUi4st9EeZG31oCp6IkIxn6BN0uZs5-PdpWVS-wdf4qaWGO1oeUg_s3eyV_0w',
    thumbnailAlt: "A cozy, warmly lit 'Just Chatting' streamer setup with fairy lights in the background.",
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA8qYKwDqUFIAj517FZ6Tyx0xolQKkH-WJa_BIJils0TnKxdVaAEZ_kVMP2kiF0FSQ2lsaKcT9RsRNrZrt6kMlSDb0Vni_fpDZPkpHcqdvDPbi9ttNdF_biDtVlyRIs4gt2JUxCPVIK8JFcchLg6Vpu5pRxVl7MrcgqwhjtaVfBgj_Ep9ONStAuXVM83U6-6a-U7GRt0EieqRVEw4HB_Sqm2JWTetz3GNfdeIdpW1qh-yi-Tef9uf4IdQ',
    avatarAlt: 'A warm, smiling portrait of a content creator looking directly at the camera.',
    showFrom: 'all',
  },
  {
    id: '3',
    title: 'Building a Web3 App from Scratch',
    streamerName: 'CodeNinja',
    category: 'Programming',
    viewerCount: '3.2K',
    thumbnailUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDRaujrtcYFgbc5nlpZs3-JHIVq5Dwpz2GTYTQsFsQFJHx4SM3yoqzHJB1OCpGo2yiD698fu3GxgT2mviepSyKBzyhdD7H5mrDIWB3Gxg3Kvehma0CnVpXeZJUGGSGxQdJ4w3FrY0DwmFdGJIfC0eex0smxlp78W1w1I64zGxApR_pmcmcuYSEqLnMzyOgqNPL0Wq5Uk2a8AnmMhjtPZs8ybSVeMWTs-W9yAdeTXS7cQ9LTxRFkqG_NDQ',
    thumbnailAlt: 'A screen recording showing complex lines of code in an IDE with vibrant syntax highlighting.',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDwQAFtOie_6_fFXJzSKaPVcvXeNJhTBJLbaVr4v6hMuSGKA8vYxxuNsgXzjP0Hjnji2nSrOc2JRHh8AjVG2RL5pHRyyERGsqC5S1QM1IaqwQn7YSRpgYs3EOIUebfKjgQx6L4W4xDnpCuwBdYQTcuBTuUSKV_JmE_ouU8EW2iDF6gosDnditOH4zVB1j-yMor21_45L96O6Ur65fTi-jFAlk-UpRbZ5lcFT-DZAbnMD-aImfGlK08-QA',
    avatarAlt: 'A serious portrait of a software developer wearing glasses, illuminated by monitor glow.',
    showFrom: 'sm',
  },
  {
    id: '4',
    title: 'Fantasy Concept Art Commissions',
    streamerName: 'BrushStrokeMaster',
    category: 'Art',
    viewerCount: '5.8K',
    thumbnailUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBht9N1EPQv7fyRGgEm6Rz4otzwMI6wqWe0U37gcChMyaflLEEtFAaJNoWOwOIfORNWYAyFDOLoE1N47NfIxVEnyhA7haQkW9TEwWYT0_CetFJYv7WuHPXAGtkW-uJhhC01SvjyNOhkNuRWxa0DUILx8sbx3dbXK1yWzoL3ygufEhOOLg5ytMKqFLHSizpzRCJ8CxK-pLK_DvlRe_o-omH4su9YQiSWFmEW1qIXIImC13aZ8yd4pXiXCQ',
    thumbnailAlt: 'A beautifully composed shot of a digital painting in progress showing a fantasy landscape with floating islands.',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDqDjAr2Kn0WwXc9rvLgZes2sItNX0iwykMSFCQqij9L6_nozeMeZnqvzvKSpWL8UxEEfdlj800rK-fe1nSBlwBtvxkidRPrrSd58Nt0vgQzpEZ7z2z2zsXchnCOv-oKWVu7D92yS2998Ytva8atOdEi9m_N8ttDeLFnz9pI9Dd1bDDZVKgBK6ZT6OZHIXLI-DpWbFH8PUI_ur0WLQuRTPwxVWDBe40hY1wC76Sx0izkKkXxvwdsy9ONQ',
    avatarAlt: 'A creative portrait of a digital artist holding a stylus pen with splashes of digital paint.',
    showFrom: 'lg',
  },
];

export default function Home() {
  const [showAll, setShowAll] = useState(false);
  const visibleStreams = showAll ? STREAMS : STREAMS.slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-[1920px] flex-1 p-md pt-16 md:p-lg md:pt-0 lg:p-xl flex flex-col gap-xl">
      {/* Featured Hero */}
      <HeroSection hero={HERO} />

      {/* Live Now */}
      <section className="flex flex-col gap-md">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse" />
          Live Now
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-md md:gap-lg">
          {visibleStreams.map((stream, i) => (
            <div
              key={stream.id}
              className={`motion-safe:animate-[fade-in-up_400ms_ease-out_backwards] ${getResponsiveClass(stream.showFrom)}`}
              style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
            >
              <HomeStreamCard stream={stream} />
            </div>
          ))}
        </div>

        {STREAMS.length > 4 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 self-center md:self-start text-primary font-label-md text-label-md hover:underline font-bold flex items-center gap-1"
          >
            {showAll ? 'Show Less' : 'Show More'}
            <ChevronDown
              className={`h-[18px] w-[18px] transition-transform ${showAll ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </section>
    </div>
  );
}
