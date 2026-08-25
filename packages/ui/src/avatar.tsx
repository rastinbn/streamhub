import clsx from 'clsx';

export interface AvatarProps {
  src?: string;
  alt?: string;
  className?: string;
}

export function Avatar({ src, alt = '', className }: AvatarProps) {
  return (
    <div className={clsx('streamhub-avatar', className)}>
      {src ? <img src={src} alt={alt} /> : <div className="streamhub-avatar-fallback" />}
    </div>
  );
}
