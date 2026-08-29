import * as React from 'react';
import clsx from 'clsx';

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

/** Elevated container: surface tier + 1px outline border (tonal layering). */
export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={clsx('bg-surface-container border border-outline-variant rounded-lg', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps) {
  return <div className={clsx('p-md', className)} {...props} />;
}

export function CardTitle({ className, ...props }: CardProps) {
  return <h3 className={clsx('text-headline-md font-headline-md text-on-surface', className)} {...props} />;
}

export function CardDescription({ className, ...props }: CardProps) {
  return <p className={clsx('text-body-sm text-on-surface-variant mt-xs', className)} {...props} />;
}

export function CardContent({ className, ...props }: CardProps) {
  return <div className={clsx('p-md pt-0', className)} {...props} />;
}
