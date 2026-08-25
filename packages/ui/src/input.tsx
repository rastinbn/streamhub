import { type InputHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return <input ref={ref} className={clsx('streamhub-input', className)} {...props} />;
});

Input.displayName = 'Input';
