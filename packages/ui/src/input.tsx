import * as React from 'react';
import clsx from 'clsx';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Surface input with a 1px outline border that lights up with the primary
 * accent (and a subtle glow) on focus, matching the design system.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx(
        'w-full bg-surface border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface placeholder:text-on-surface-variant outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
