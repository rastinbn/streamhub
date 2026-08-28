'use client';

import * as React from 'react';
import clsx from 'clsx';

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error('Tabs components must be used within <Tabs>');
  return ctx;
}

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children?: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, setValue: onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps {
  children?: React.ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={clsx('inline-flex items-center gap-xs border-b border-outline-variant', className)}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps {
  value: string;
  children?: React.ReactNode;
  className?: string;
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { value: active, setValue } = useTabs();
  const selected = active === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => setValue(value)}
      className={clsx(
        'px-md py-sm text-label-md font-label-md transition-colors border-b-2 -mb-px',
        selected
          ? 'border-primary-container text-on-surface'
          : 'border-transparent text-on-surface-variant hover:text-on-surface',
        className,
      )}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps {
  value: string;
  children?: React.ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { value: active } = useTabs();
  if (active !== value) return null;
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
}
