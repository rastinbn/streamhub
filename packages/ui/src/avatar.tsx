import clsx from 'clsx';

export type AvatarStatus = 'live' | 'online' | 'offline';
export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  src?: string;
  alt?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'w-6 h-6',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

const statusColor: Record<AvatarStatus, string> = {
  live: 'bg-error',
  online: 'bg-[#4ade80]',
  offline: 'bg-outline-variant',
};

/**
 * Circular avatar with an optional 2px status ring (green online / red live /
 * gray offline) per the design system.
 */
export function Avatar({ src, alt = '', size = 'md', status, className }: AvatarProps) {
  return (
    <div className={clsx('relative shrink-0 rounded-full', sizeClasses[size], className)}>
      {src ? (
        <img src={src} alt={alt} className="w-full h-full rounded-full object-cover" />
      ) : (
        <div className="w-full h-full rounded-full bg-surface-variant" />
      )}
      {status && (
        <span
          className={clsx(
            'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-container-low',
            statusColor[status],
          )}
        />
      )}
    </div>
  );
}
