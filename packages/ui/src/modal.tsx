'use client';

import * as React from 'react';
import clsx from 'clsx';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Floating modal. Only modals use a shadow (24px blur, 10% black, no offset)
 * per the design system. Closes on overlay click or the × control.
 */
export function Modal({ open, onClose, title, children, className }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-md"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={clsx(
          'relative z-10 w-full max-w-md bg-surface-container border border-outline-variant rounded-lg shadow-[0_24px_24px_rgba(0,0,0,0.1)]',
          className,
        )}
      >
        <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant">
          {title ? (
            <h2 className="text-headline-md font-headline-md text-on-surface">{title}</h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded text-on-surface-variant hover:bg-surface-variant transition-colors"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>
        <div className="p-md">{children}</div>
      </div>
    </div>
  );
}
