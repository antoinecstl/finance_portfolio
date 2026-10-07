'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, CreditCard, Shield, AlertTriangle, KeyRound, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  user: User,
  billing: CreditCard,
  shield: Shield,
  api: KeyRound,
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

  // Mobile : puce compacte dans une rangée défilante. À partir de md : ligne avec description.
  const base =
    'group flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors md:items-start md:gap-3 md:whitespace-normal md:rounded-lg md:px-3 md:py-2.5';

  const activeCls = danger
    ? 'bg-[color:var(--loss-soft)] border-[color:var(--loss)] text-[color:var(--loss)]'
    : 'bg-[color:var(--accent-soft)] border-[color:var(--accent)] text-[color:var(--accent)]';

  const idleCls = danger
    ? 'border-[color:var(--rule)] md:border-transparent text-[color:var(--ink)] hover:bg-[color:var(--loss-soft)] hover:text-[color:var(--loss)]'
    : 'border-[color:var(--rule)] md:border-transparent text-[color:var(--ink)] hover:bg-[color:var(--paper-2)]';

  return (
    <Link href={href} className={`${base} ${active ? activeCls : idleCls}`} aria-current={active ? 'page' : undefined}>
      <Icon className="h-4 w-4 flex-shrink-0 md:mt-0.5" />
      <span className="min-w-0 md:flex-1">
        <span className="block font-medium">{label}</span>
        <span
          className={`hidden text-xs mt-0.5 md:block ${
            active ? 'opacity-80' : 'text-[color:var(--ink-soft)]'
          }`}
        >
          {description}
        </span>
      </span>
    </Link>
  );
}
