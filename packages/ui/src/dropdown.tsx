import { type ReactNode } from 'react';

export interface DropdownProps {
  trigger: ReactNode;
  children?: ReactNode;
}

export function Dropdown({ trigger, children }: DropdownProps) {
  return (
    <div className="streamhub-dropdown">
      <div className="streamhub-dropdown-trigger">{trigger}</div>
      <div className="streamhub-dropdown-content">{children}</div>
    </div>
  );
}
