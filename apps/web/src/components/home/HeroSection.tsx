import Image from 'next/image';
import { Users, Play } from 'lucide-react';

export interface HeroData {
  title: string;
  streamerName: string;
  category: string;
  tags: string[];
  viewerCount: string;
  thumbnailUrl: string;
  thumbnailAlt: string;
  avatarUrl: string;
  avatarAlt: string;
}

export default function HeroSection({ hero }: { hero: HeroData }) {
  return (
    <section className="relative w-full rounded-xl overflow-hidden bg-surface-container border border-surface-container-high group cursor-pointer shadow-lg">
      {/* 16:9 → 21:9 → 24:9 */}
      <div className="relative w-full aspect-video md:aspect-[21/9] lg:aspect-[24/9] bg-surface-container-high overflow-hidden">
        {/* Background image */}
        <Image
          className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700 ease-out"
          src={hero.thumbnailUrl}
          alt={hero.thumbnailAlt}
          fill
          sizes="100vw"
        />

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-surface-container-lowest via-surface-container-lowest/30 to-transparent" />

        {/* Top-left badges */}
        <div className="absolute top-4 left-4 flex gap-sm items-center z-10">
          <div className="bg-error text-on-error font-label-sm text-label-sm px-2 py-1 rounded font-bold tracking-wider">
            LIVE
          </div>
          <div className="bg-black/60 backdrop-blur-sm border border-outline-variant/30 text-white font-label-sm text-label-sm px-2 py-1 rounded flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {hero.viewerCount}
          </div>
        </div>

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 w-full p-md md:p-lg flex flex-col md:flex-row justify-between items-start md:items-end gap-md z-10">
          <div className="flex items-end gap-md">
            {/* Avatar */}
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-error bg-surface-container-high overflow-hidden shadow-lg shrink-0 relative">
              <Image
                className="w-full h-full object-cover"
                src={hero.avatarUrl}
                alt={hero.avatarAlt}
                width={80}
                height={80}
              />
              <div className="absolute inset-0 rounded-full shadow-[0_0_15px_rgba(255,180,171,0.5)]" />
            </div>

            {/* Text */}
            <div className="flex flex-col gap-1 min-w-0">
              <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface line-clamp-2 md:line-clamp-1 drop-shadow-md">
                {hero.title}
              </h1>
              <div className="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm">
                <span className="font-bold text-on-surface">{hero.streamerName}</span>
                <span>·</span>
                <span className="text-primary hover:underline cursor-pointer">{hero.category}</span>
              </div>
              {hero.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {hero.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-surface-variant/80 backdrop-blur border border-outline-variant/50 text-on-surface-variant font-label-sm text-label-sm px-2 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Watch button */}
          <button
            type="button"
            className="w-full md:w-auto bg-primary text-on-primary font-headline-md px-6 py-3 rounded-lg font-bold hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-[0_0_20px_rgba(213,186,255,0.2)] active:scale-95 shrink-0 flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5 fill-current" />
            Watch Now
          </button>
        </div>
      </div>
    </section>
  );
}
