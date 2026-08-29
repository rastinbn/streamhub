import { Bell, Search } from 'lucide-react';

/**
 * Mobile top bar. Hidden on >=md where the Sidebar takes over navigation.
 * Mirrors the glassmorphism header from the design system.
 */
export default function Navbar() {
  return (
    <header className="md:hidden flex justify-between items-center px-lg h-16 w-full bg-background/80 backdrop-blur-md fixed top-0 z-50 border-b border-outline-variant/30">
      <span className="text-headline-md font-headline-lg text-primary tracking-tight">StreamHub</span>
      <div className="flex items-center gap-sm">
        <button
          type="button"
          className="p-2 text-on-surface-variant hover:bg-surface-variant transition-colors rounded-full active:scale-95 duration-150"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>
        <button
          type="button"
          className="p-2 text-on-surface-variant hover:bg-surface-variant transition-colors rounded-full active:scale-95 duration-150"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
