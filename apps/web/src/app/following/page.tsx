'use client';

import { Camera } from 'lucide-react';
import LiveCardItem, { LiveCard } from '@/components/streams/LiveCardItem';
import OfflineCardItem, { OfflineCard } from '@/components/streams/OfflineCardItem';

const LIVE_STREAMS: LiveCard[] = [
  {
    id: 'live-1',
    channelName: 'NeonNinja',
    streamTitle: 'Cyber Drift Championship Finals',
    tags: ['Racing', 'Esports'],
    viewerCount: '14.2K',
    thumbnailUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBjdMyAng8G9vJz6TzTUFJhHD2iFrIjsJ5uEmfthYA03H1sRdbXTSWQXKsPCfBK7Dehuxs4Zog09WtJkiBasTgT_Fetnu_FlPXRkymt8UXDBLySMfLb-Kz6LcxO3k8d6LGLYLvQjD--xVzfidWi72pOxovs3TYHJsFFeFZp-PhxX6db5FxBB3N6kIfK0OmKDIziU2uFF6I70Bb55uXbw4C0U16TOOf54opPi9EGc4tEGcXs37lWXt_J9A',
    thumbnailAlt: 'A high-octane screenshot of a sci-fi racing game, featuring sleek hovercrafts speeding through a neon-drenched futuristic city under a dark, moody atmosphere.',
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBvdOLiNMHDZtU_LReK2cuHyc-41Incq9Iid1BoTO607fSiWxTBW-xmp9XMgYyuQ6oUWj950WP9DB5aPCzHo2GMFCO6zVHVYuwfHJarbjLY9Yyo0IOPtJPgBJGIxZaQ1Hd_cmFtKPMz2M-pXOACDQc0tmZIhuCtvUOVgUEYS4L41zFP8sQFBoMTI1my8Oqmy2JXsI1jTzMyDSAr8L0UO9yh6yIHvys_TbKaumEUxNJyEK5yZK-ROgMJQQ',
    avatarAlt: 'Avatar of a streamer with bright neon-green glasses and a dark hoodie, set against a dark purple abstract background.',
  },
  {
    id: 'live-2',
    channelName: 'ProGamerX',
    streamTitle: 'Ranked Grind - Road to Predator',
    tags: ['FPS'],
    viewerCount: '8.5K',
    thumbnailUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB4MGzmGn7Wifm5r_h_oAy9BR_N9NSYVhKPwb7CYZs_Rt0Z1_k8X1p_L8WS2X2jYbREED1u-Crt17f8ybjhXKziXwCB1S9V-3Cj9VyOv_8OX7_f3g8R9PJNweVDbpij-wb8t_-ZaeQel5j1l6fdRHcCaQZU5R_SHNhBxEVqiA45Z3YXL_xrGXVMVatmxd8Txuj-rjqcvuYGolcuGRIvf0vM2WOugIR5Dud5sDxwDRZY4-QTT7eLUL2e-Q',
    thumbnailAlt: 'A tactical view of a dark, gritty sci-fi shooter game, showing a highly detailed weapon in the foreground and dimly lit corridors with red emergency lights in the background.',
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAdCt-qf9OvY2e6lqAveuoyYCrQK8mUEIKjfNnw4ZIa0yHsSYih28pKch4W9GAieldCE4UNj9WRICCKqAirWZMet079Ua1Gu5FdplVc1uFP9NCD5gPPaAfHnlr8hrAtgNb275PuwJxj2JSp8RNnWl6x8Q5jsLcWu7_NAW5Oa5THLOi-16_Yf8Z6ppiLmWSY21gPxwnMawLVx-m22KwVrUSF7AIKkI3aWVqcg29F2CL3tOxUR_u3zsqO_g',
    avatarAlt: 'Avatar of an intense-looking esports player wearing a dark gaming headset, illuminated by blue monitor glow.',
  },
  {
    id: 'live-3',
    channelName: 'CanvasQueen',
    streamTitle: 'Dark Fantasy Concept Art',
    tags: ['Art'],
    viewerCount: '1.2K',
    thumbnailUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC4VW4S5D0ZMvio8D5X7TfJHFRretHeIHUUhxv0r03OElnLMn7ZfipxkBWTRwGFN1YRHM3SJOP2oMGF9UeZbv1NhuZc47MagYLehLA5D5aUWfQOaV0DsYKUxBe03f8VoseKklPupP0RgVDLTmGqaqSc1iapwRdeDh4ejoaz4cR4fjgeou_bBQ60in9_XB4OBijN4rHuxVAVu1zIMw8QMkKOKoBqDi5PHOfXCM2qz9oLF7FBaoLXpjIQiA',
    thumbnailAlt: 'A serene digital painting process shown on screen, featuring a dark fantasy landscape with a glowing mystical tree.',
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB7ftFIVgWub0fe2DntnSkgPFQxC5qKGHrTyBe-ASA2K-3DQdE_hDajQ0ep1VjkGhtBLRFgUW_76pQlUSx6kEP7Xadk6IYKG-PtLiJ1crjRJcJ94tA1YcC-W8z-AGC32y0jqSGg73Y9Ww9QoHw3AoXwmSNehqJ9oj_GvieWJL_khPvG6nxfTYmXOhcCAmfhu_nQ1PVZjx8WZbh36bbFRlQEmSSJtzbS-ubwn2eOJtFL8M9c0K27CQEGiA',
    avatarAlt: 'Avatar of an artist with a beret, drawn in an elegant anime style with deep indigo and violet colors.',
  },
  {
    id: 'live-4',
    channelName: 'DevStreamer',
    streamTitle: 'Building a React UI Component',
    tags: ['Software'],
    viewerCount: '540',
    thumbnailUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmW1Qt9zu-fuaR5D0TRHIqgBySeAuu9yjkdGagVWo_RO2l12oGceFUH__hVUsXwVGU6A43w8mBxda7CYsJvFqsO34xz9GG8k-FqeSKV3i6ZcXb-SEgcDzH-b2u7LSS5OA-4xs3fwcG_31a2Ydd1_wRlpJT9q08RtXOxg0Cu0oEHfAS_Dznm_CW2s9TUH4yK5t2UwFb0trFZSJcHrWLTINxpWIlTvazNeH6doE5wkWUarxFC-CFqfxpsg',
    thumbnailAlt: 'A complex code editor interface with dark mode theme, showing lines of colorful syntax highlighted code for a web application.',
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDllHWLplwFT7QNiMcr4Gy0pBrqv8r4A-QzV30YgKHopyrRZDyUEVF-BR1CnbNC6dsSXqOZsfs31BU6EGSbqhvA0ui4bGclt9opVhBHkvYjVoZ2mwTw8d8XUGDLsYLFOHKFBcAOOlnBCSEM2y6exaZonuTTxuXKP7WqRQZHBpSpx1SL6FZFGcR9_B1_dACwX3MH5sc_7G83wcipDEvRPD2SQOvhTJeo_bDvAD5UxYWB1-GFzeo6cvbxAg',
    avatarAlt: 'Avatar of a developer with glasses, illuminated by the soft glow of a monitor displaying code.',
  },
];

const OFFLINE_CHANNELS: OfflineCard[] = [
  {
    id: 'off-1',
    channelName: 'ChillVibes',
    lastSeen: '2h ago',
    thumbnailUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBYw3YRI8fuExhufPLT2x6CylXKKiCsqEUdps50NrLAWiBytCBITXMvcFNDl_EEp9GJ_GtiHlKbiRJGYUJeF4k9322I4ayr5h1wRLKs8o2i6sJf2dJh3Mzw8OU6obYXhR_Zj204Qpxpw-YPBw8OnAkBZVE6PgISp_JMsBLrZ64C0ifKcXmXR0fxZPfFAjbXKoBCsKKL1FT8fP2BkBu9HRJZp7yPuEqnv8G0L_x4PlU12EP2qhtQKVld2w',
    thumbnailAlt: 'A grayscale screenshot of a calm, atmospheric puzzle game showing geometric shapes floating in void.',
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUHQHSQJ-KsSeLbxuiKDrT0_N9hY_30ICRKq2uL-V-IwB9CAa-zPOJa_zwyDkqJqg5rneaomHbKW4JIaooFMmqvLtSS2aIrFA2cl-Im6UMieliN6OvJY5ZxEJGvDECOI0bf24bDYxogMh591TzRXfg2eg1uDMYHriI3-Mwo3mWJVNJemyGPyv7CHTQCTndwG6zle4il9eO5tIFJpWd-rIqbhnjq0AKWW6WF0qb0EvonVgfo-JkGgqpYQ',
    avatarAlt: 'Small avatar of a gamer, grayscale styling to indicate offline status.',
  },
  {
    id: 'off-2',
    channelName: 'BeatMaker',
    lastSeen: '5h ago',
    thumbnailUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD_QSTprwFhmi642mJ0grEeJ6KBaMVxSmAJwdkSv6CEuqiRVsdhX-PYRj29UPXtkeKVuxwyKtkFjZVW6l5-taaGjme-9MAwQbKNMKUjio5vfjZcGXhWMfP_42c9JRzkfXY8-dce9qdQBj3JqpPQqG78iRBNaihn2cFqUN6M3GJjlQzB10lTXMywE8AhxAvVRqijq3WZhTM5U9UoBBl3Mh-EtisKyyv0V5m0tIHk2O2jQ_FpC7wAAKK3Rg',
    thumbnailAlt: 'A grayscale screenshot of a music production software interface with multiple tracks and digital synthesizers.',
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBW6pgbMPPTYOw_KlmK8Ucm__F73fkIueOwrMm0HsYpraKGyr6PnpCsrCRhv95XVy0BhoEWaAArydbqh6uhR_mzv_aOHDg76pIYN0rUDMhklIV1IMCs8C3HjX_7RfWDMWSBMjXPYxOOqCbsiYk4pWB5k-FqR4LaPaiU3HxuflgvWxqKZN73Vt_snaOPQba8HNNoyW8JNcYI5RrBN89kTu2XXT1LKgXfuc8DdqmyTK5trBmTlAyEaWrMLg',
    avatarAlt: 'Small avatar of a music producer, grayscale styling to indicate offline status.',
  },
  {
    id: 'off-3',
    channelName: 'StratMaster',
    lastSeen: '1d ago',
    thumbnailUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCUXwJZCQrY2S_jRBfGXzgKC6iy2z46kU2NR-uvaKO53fYGXALcF4YS-nLt-tRPADEWqoNivIXDbrVPLaoACz8Xjzpw2TBLug_fq0YwWUIe3IQKhxfEaRK-0F6JcDBCPskVGmGUIgc3cnioJa6VKvOZ8YxFhVrh737HAw2czgl2f0ftdEgIWJ7JjczB0otATXBy6m69SvezkrdKoCsn25kEShREEABxft40kRucINGQwlYH0KM8GmRQTQ',
    thumbnailAlt: 'A grayscale screenshot of an intricate strategy game map showing tech trees and units.',
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD33QO75ZcUb-Xzct26tIFYzqne3rV3opit3mbSblrrTY0zfrWwzahM3lZ152iqBsYgMUQ-lHsDVpcomvTcyub1xzR_5nkp-ETsqzw3aAuSOtDodLUfsMBZDcuePdjECbWhU5IwMKfTPB18O23Z6WvuiSlo5hwhAYogrvUuLh6_DZi3sjBlqtAM2gGFrdrbmSco0nNSthbJJSZ5qW-9jzZ0_VdbBTgUYJnrcL8vOmNDaG2oa-AJgHgtsQ',
    avatarAlt: 'Small avatar of a strategy gamer, grayscale styling to indicate offline status.',
  },
];

export default function Following() {
  return (
    <div className="mx-auto w-full max-w-[1920px] flex-1 p-md pt-16 md:p-lg md:pt-0 lg:p-xl">
      {/* Header */}
      <div className="mb-xl">
        <h1 className="text-headline-lg-mobile font-headline-lg-mobile text-on-surface md:text-headline-lg md:font-headline-lg">
          Following
        </h1>
        <p className="mt-xs text-body-md font-body-md text-on-surface-variant">
          Channels you love, live and offline.
        </p>
      </div>

      {/* Live Now */}
      <section className="mb-xl">
        <div className="flex items-center gap-3 mb-md">
          <h2 className="font-headline-md text-headline-md text-on-surface">Live Now</h2>
          <span className="h-2.5 w-2.5 rounded-full bg-error animate-pulse shadow-[0_0_8px_rgba(255,180,171,0.5)]" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-layout-gutter">
          {LIVE_STREAMS.map((stream, i) => (
            <div
              key={stream.id}
              className="motion-safe:animate-[fade-in-up_400ms_ease-out_backwards]"
              style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
            >
              <LiveCardItem stream={stream} />
            </div>
          ))}
        </div>

        {LIVE_STREAMS.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-outline-variant py-2xl text-center">
            <Camera className="h-8 w-8 text-outline" />
            <p className="text-body-md font-body-md text-on-surface-variant">
              No channels you follow are live right now.
            </p>
          </div>
        )}
      </section>

      {/* Offline Channels */}
      <section>
        <div className="mb-md border-t border-outline-variant/30 pt-lg">
          <h2 className="font-headline-md text-headline-md text-outline">Offline Channels</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-layout-gutter">
          {OFFLINE_CHANNELS.map((channel, i) => (
            <div
              key={channel.id}
              className="motion-safe:animate-[fade-in-up_400ms_ease-out_backwards]"
              style={{ animationDelay: `${Math.min(i + LIVE_STREAMS.length, 14) * 40}ms` }}
            >
              <OfflineCardItem channel={channel} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
