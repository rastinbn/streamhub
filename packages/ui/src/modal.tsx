import { type ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
}

/**
 * Placeholder Modal. Real focus-trap / portal behavior to be implemented
 * when a feature actually needs it.
 */
export function Modal({ open, onClose, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="streamhub-modal-overlay" onClick={onClose}>
      <div className="streamhub-modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
