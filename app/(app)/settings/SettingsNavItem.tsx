'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, CreditCard, Shield, AlertTriangle, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  user: User,
  billing: CreditCard,
  shield: Shield,
  danger: AlertTriangle,
};

export type SettingsIconKey = keyof typeof ICONS;

export function SettingsNavItem({
  href,
  label,
  description,
  icon,
  danger = false,
}: {
  href: string;
  label: string;
  description: string;
  icon: SettingsIconKey;
  danger?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  const Icon = ICONS[icon];

  const base =
    'group flex items-start gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors border border-transparent';

  const activeCls = danger
    ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300'
    : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/40 text-blue-700 dark:text-blue-300';

  const idleCls = danger
    ? 'text-zinc-700 dark:text-zinc-300 hover:bg-red-50/50 dark:hover:bg-red-950/20 hover:text-red-700 dark:hover:text-red-400'
    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900';

  return (
    <Link href={href} className={`${base} ${active ? activeCls : idleCls}`}>
      <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block font-medium">{label}</span>
        <span
          className={`block text-xs mt-0.5 ${
            active ? 'opacity-80' : 'text-zinc-500 dark:text-zinc-500'
          }`}
        >
          {description}
        </span>
      </span>
    </Link>
  );
}
