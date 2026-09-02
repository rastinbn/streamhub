import { Radio } from 'lucide-react';

export interface CategoryCardProps {
  name: string;
  badge: string;
  viewers: string;
  liveChannels: string;
  image: string;
  alt: string;
};


export default function CategoryCard({ name, badge, viewers, liveChannels, image, alt }: CategoryCardProps) {
  return (
    <a
      href="#"
      className="group block relative rounded-xl overflow-hidden bg-surface border border-outline-variant/30 hover:border-primary/50 hover:bg-surface-variant transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1"
    >
      <div className="aspect-[3/4] relative w-full overflow-hidden">
        <img
          src={image}
          alt={alt}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/90 via-surface-container-lowest/20 to-transparent" />

        <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
          <span className="bg-surface/80 backdrop-blur-sm text-on-surface px-2 py-1 rounded font-label-sm text-label-sm border border-outline-variant/50">
            {badge}
          </span>

          <span className="bg-primary-container text-on-primary-container px-2 py-1 rounded font-label-sm text-label-sm flex items-center gap-1 shadow-sm">
            <span className="w-1.5 h-1.5 bg-secondary-fixed rounded-full animate-pulse" />
            {viewers}
          </span>
        </div>
      </div>

      <div className="p-3 absolute bottom-0 left-0 right-0 z-10">
        <h3 className="font-headline-md text-headline-md text-on-surface truncate group-hover:text-primary transition-colors text-lg leading-tight mb-1">
          {name}
        </h3>

        <div className="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm">
          <Radio size={16} />
          {liveChannels}
        </div>
      </div>
    </a>
  );
}
