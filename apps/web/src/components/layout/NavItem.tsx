"use client"

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

export interface NavItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
}

export default function NavItem({ icon: Icon, label, href }: NavItemProps) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <li>
      <Link
        href={href}
        className={`flex items-center gap-md px-sm py-sm rounded-lg transition-all cursor-pointer active:opacity-80 ${
          active
            ? 'bg-primary-container text-on-primary-container mx-2'
            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant mx-2'
        }`}
      >
        <Icon className="w-5 h-5 shrink-0" />
        <span className="text-label-md font-label-md hidden xl:block whitespace-nowrap">
          {label}
        </span>
      </Link>
    </li>
  );
}
