import { type HTMLAttributes } from 'react';
import clsx from 'clsx';

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return <div className={clsx('streamhub-card', className)} {...props} />;
}
