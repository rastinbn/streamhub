import * as React from 'react';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary-container text-on-primary-container hover:bg-primary-container/90',
  secondary: 'border border-primary-container text-primary-container bg-transparent hover:bg-primary-container/10',
  ghost: 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-sm text-body-sm',
  md: 'h-10 px-md text-body-md',
  lg: 'h-12 px-lg text-body-lg',
  icon: 'h-10 w-10',
};

/**
 * Primary action uses the electric-purple container from the design system.
 * Secondary is an outlined variant; ghost is a low-emphasis text button.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={clsx(
        'inline-flex items-center justify-center gap-sm rounded-lg font-medium transition-colors active:opacity-80 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
