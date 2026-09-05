import { Link2 } from 'lucide-react';

export default function RoutePlaceholder({
  route,
  description,
  status = 'pending',
}: {
  route: string;
  description: string;
  status?: 'pending' | 'draft';
}) {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-variant/60">
          <Link2 className="h-5 w-5 text-on-surface-variant" />
        </span>
        <h1 className="mt-md font-headline-lg text-headline-lg text-on-surface">{route}</h1>
        <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          {description}
        </p>
        <div className="mt-md inline-flex items-center gap-1.5 rounded-full bg-surface-variant/60 px-3 py-1">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === 'draft' ? 'bg-online' : 'bg-outline-variant'
            }`}
          />
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">
            {status === 'draft' ? 'In progress' : 'Not built yet'}
          </span>
        </div>
      </div>
    </div>
  );
}