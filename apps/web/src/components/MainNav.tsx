'use client';

import { Compass, Home, LayoutGrid, Rss, Settings, HelpCircle } from 'lucide-react';
import NavItem, { type NavItemProps } from './NavItem';

const DISCOVERY_ITEMS: NavItemProps[] = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: Compass, label: 'Browse', href: '/browse' },
  { icon: LayoutGrid, label: 'Categories', href: '/categories' },
  { icon: Rss, label: 'Following', href: '/following' },
];

const FOOTER_ITEMS: NavItemProps[] = [
  { icon: Settings, label: 'Settings', href: '/settings' },
  { icon: HelpCircle, label: 'Help', href: '/help' },
];

export default function MainNav() {
  return (
    <>
      <div className="px-sm mt-md xl:px-md">

        <ul className="flex flex-col gap-xs">
          {DISCOVERY_ITEMS.map((item) => (
            <NavItem key={item.label} {...item} />
          ))}
        </ul>
      </div>

      <hr/>

      <div className="mt-auto px-sm mb-md xl:px-md">
        <ul className="flex flex-col gap-xs">
          {FOOTER_ITEMS.map((item) => (
            <NavItem key={item.label} {...item} />
          ))}
        </ul>
      </div>
    </>
  );
}
