import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface ToastProps {
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'error';
  action?: ReactNode;
  className?: string;
}

const variantClasses: Record<NonNullable<ToastProps['variant']>, string> = {
  default: 'border-outline-variant bg-surface-container text-on-surface',
  success: 'border-secondary-container/40 bg-surface-container text-on-surface',
  error: 'border-live/40 bg-surface-container text-on-surface',
};

const iconColor: Record<NonNullable<ToastProps['variant']>, string> = {
  default: 'bg-surface-variant',
  success: 'bg-secondary-container',
  error: 'bg-live',
};

/**
 * Compact, floating toast used for transient feedback (e.g. "followed",
 * "message sent"). Left accent strip communicates the variant; actions are
 * optional (typically a dismiss button). Consumers bring their own React
 * portal/animation layer if needed.
 */
export function Toast({ title, description, variant = 'default', action, className }: ToastProps) {
  return (
    <div
      role="status"
      className={clsx(
        'flex items-start gap-md rounded-lg border px-md py-sm shadow-[0_24px_24px_rgba(0,0,0,0.1)]',
        variantClasses[variant],
        className,
      )}
    >
      <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', iconColor[variant])} />
      <div className="min-w-0 flex-1">
        <p className="font-body-sm text-body-sm font-semibold text-on-surface">{title}</p>
        {description && <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}