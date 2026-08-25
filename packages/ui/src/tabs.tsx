import { type ReactNode } from 'react';

export interface TabsProps {
  children?: ReactNode;
}

/**
 * Placeholder Tabs primitive. To be replaced/expanded with shadcn/ui Tabs
 * when the dashboard UI is implemented.
 */
export function Tabs({ children }: TabsProps) {
  return <div className="streamhub-tabs">{children}</div>;
}
