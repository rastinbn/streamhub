import type { HTMLAttributes } from 'react';
import clsx from 'clsx';

export type BadgeVariant = 'default' | 'live' | 'category' | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-variant text-on-surface',
  live: 'bg-error text-on-error',
  category: 'bg-surface-container-high text-on-surface-variant',
  outline: 'border border-outline-variant text-on-surface-variant',
};

/**
 * Compact, "tab-like" pill (4px radius) used for LIVE indicators and category
 * tags. LIVE/category labels render in JetBrains Mono uppercase.
 */
export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-xs rounded-sm px-2 py-0.5 text-label-sm font-label-sm uppercase tracking-wide',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
