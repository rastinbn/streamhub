import StreamCard, { StreamCardProps } from '@/components/StreamCard';
import { ChevronDown, Loader2 } from 'lucide-react';

const FILTERS: { label: string; active?: boolean; liveDot?: boolean }[] = [
  { label: 'All', active: true },
  { label: 'Live Now', liveDot: true },
  { label: 'Categories' },
  { label: 'Most Viewed' },
  { label: 'Recently Started' },
  { label: 'Recommended' },
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

export default function Page() {
  return (
    <div className="flex-1 pt-16 md:pt-0 p-md md:p-lg lg:p-xl max-w-[1920px] mx-auto w-full">
      <div className="mb-lg md:mb-xl flex flex-col gap-md md:flex-row md:items-end justify-between">
        <div>
          <h1 className="text-headline-lg-mobile md:text-headline-lg font-headline-lg-mobile md:font-headline-lg text-on-surface mb-xs">
            Browse Streams
          </h1>
          <p className="text-body-md font-body-md text-on-surface-variant">
            Discover top live content across all categories.
          </p>
        </div>
        <div className="relative w-full md:w-auto">
          <button
            type="button"
            className="w-full md:w-48 flex items-center justify-between px-md py-sm bg-surface border border-outline-variant rounded-lg text-body-sm font-body-sm hover:border-primary transition-colors group"
          >
            <span className="text-on-surface">
              Sort by: <strong className="font-semibold ml-1">Most Viewers</strong>
            </span>
            <ChevronDown className="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" />
          </button>
        </div>
      </div>

      <div className="w-full overflow-x-auto pb-sm mb-lg no-scrollbar">
        <div className="flex items-center gap-sm min-w-max">
          {FILTERS.map((filter) => (
            <button
              key={filter.label}
              type="button"
              className={
                filter.active
                  ? 'px-md py-sm rounded-full bg-primary-container text-on-primary-container text-label-md font-label-md font-semibold tracking-wide transition-colors'
                  : 'px-md py-sm rounded-full border border-outline-variant bg-transparent text-on-surface-variant hover:bg-surface-variant hover:text-on-surface text-label-md font-label-md transition-colors flex items-center gap-xs'
              }
            >
              {filter.liveDot && <span className="w-2 h-2 rounded-full bg-error" />}
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-layout-gutter md:gap-lg">
        {STREAM_CARDS.map((stream) => (
          <StreamCard
            key={stream.id}
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
        ))}
      </div>

      {/*<div className="w-full py-xl flex justify-center items-center mt-lg border-t border-outline-variant/30">*/}
      {/*  <Loader2 className="w-8 h-8 text-primary animate-spin" />*/}
      {/*</div>*/}
    </div>
  );
}
