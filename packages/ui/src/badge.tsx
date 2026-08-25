import { type HTMLAttributes } from 'react';
import clsx from 'clsx';

export type BadgeProps = HTMLAttributes<HTMLSpanElement>;

export function Badge({ className, ...props }: BadgeProps) {
  return <span className={clsx('streamhub-badge', className)} {...props} />;
}
