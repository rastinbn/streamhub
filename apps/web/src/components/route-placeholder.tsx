import type { ReactNode } from 'react';

export interface RoutePlaceholderProps {
  route: string;
  description?: string;
  children?: ReactNode;
}

function titleFor(route: string): string {
  if (route === '/' || route === '') return 'Home';
  return route
    .split('/')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Minimal, on-brand placeholder for routes that are not implemented yet.
 * Renders inside the app shell (sidebar + mobile header) and matches the
 * dark-first design tokens. Keeps the build green while pages are scaffolded.
 */
export function RoutePlaceholder({ route, description, children }: RoutePlaceholderProps) {
  return (
    <div className="flex-1 pt-16 md:pt-0 p-md md:p-lg lg:p-xl w-full">
      <div className="max-w-[1920px] mx-auto">
        <div className="flex items-center gap-sm mb-md">
          <span className="inline-flex items-center rounded-full bg-error/15 text-error px-2 py-0.5 text-label-sm font-label-sm uppercase tracking-wide">
            Soon
          </span>
          <span className="text-label-sm font-label-sm text-on-surface-variant">{route}</span>
        </div>
        <h1 className="text-headline-lg-mobile md:text-headline-lg font-headline-lg text-on-surface mb-xs">
          {titleFor(route)}
        </h1>
        {description && <p className="text-body-md text-on-surface-variant mb-lg">{description}</p>}
        <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container/40 p-xl text-on-surface-variant text-body-md">
          This screen is a Phase 1 placeholder. The full experience will follow the provided
          UI reference.
        </div>
        {children}
      </div>
    </div>
  );
}

export default RoutePlaceholder;
