'use client';

import * as React from 'react';
import clsx from 'clsx';

interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

function useDropdown() {
  const ctx = React.useContext(DropdownContext);
  if (!ctx) throw new Error('Dropdown components must be used within <Dropdown>');
  return ctx;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  children?: React.ReactNode;
  align?: 'start' | 'end';
  className?: string;
  /** Close the menu when an item inside is clicked. */
  closeOnSelect?: boolean;
}

/**
 * Menu / sort-control dropdown. Clicking the trigger toggles the panel; an
 * outside click or Escape closes it. Used for sort controls (browse/following)
 * and "more options" menus.
 */
export function Dropdown({
  trigger,
  children,
  align = 'end',
  className,
  closeOnSelect = true,
}: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div ref={rootRef} className={clsx('relative inline-block', className)}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="cursor-pointer"
        >
          {trigger}
        </button>
        {open && (
          <div
            role="menu"
            onClick={() => closeOnSelect && setOpen(false)}
            className={clsx(
              'absolute z-30 mt-xs min-w-[10rem] overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-low shadow-[0_24px_24px_rgba(0,0,0,0.1)]',
              align === 'end' ? 'right-0' : 'left-0',
            )}
          >
            {children}
          </div>
        )}
      </div>
    </DropdownContext.Provider>
  );
}

export interface DropdownItemProps {
  onSelect?: () => void;
  active?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function DropdownItem({ onSelect, active, children, className }: DropdownItemProps) {
  const { setOpen } = useDropdown();
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        onSelect?.();
        setOpen(false);
      }}
      className={clsx(
        'flex w-full items-center gap-sm px-md py-sm text-left font-body-sm text-body-sm transition-colors',
        active ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface',
        className,
      )}
    >
      {children}
    </button>
  );
}

const _DropdownSeparator = function DropdownSeparator({ className }: { className?: string }) {
  return <div className={clsx('my-xs h-px bg-outline-variant/40', className)} />;
};

export { _DropdownSeparator as DropdownSeparator };