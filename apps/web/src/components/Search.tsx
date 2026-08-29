import { Search as SearchIcon } from 'lucide-react';
import { Input } from '@streamhub/ui';
import { cn } from '@/lib/utils';

export interface SearchProps {
  placeholder?: string;
  className?: string;
}

/** Search field with a leading icon; built on the shared Input primitive. */
export function Search({ placeholder = 'Search', className }: SearchProps) {
  return (
    <div className={cn('relative w-full', className)}>
      <SearchIcon className="absolute left-sm top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
      <Input className="pl-10" placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}
