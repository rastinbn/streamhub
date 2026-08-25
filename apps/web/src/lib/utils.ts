import { type ClassValue, clsx } from 'clsx';

/**
 * Minimal className combiner. A `tailwind-merge` dependency can be added
 * later if class conflicts become an issue; kept lightweight for now.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
