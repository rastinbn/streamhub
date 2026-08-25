import { type ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
};

/**
 * Placeholder Button primitive. Styling will be fleshed out alongside the
 * shadcn/ui setup in apps/web; this shared version exists so cross-app
 * consumers (web, future admin panels) can rely on a stable import path.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx('streamhub-button', `streamhub-button--${variant}`, className)}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
