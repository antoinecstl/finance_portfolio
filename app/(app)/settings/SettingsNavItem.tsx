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
    ? 'bg-[color:var(--loss-soft)] border-[color:var(--loss)] text-[color:var(--loss)]'
    : 'bg-[color:var(--accent-soft)] border-[color:var(--accent)] text-[color:var(--accent)]';

  const idleCls = danger
    ? 'text-[color:var(--ink)] hover:bg-[color:var(--loss-soft)] hover:text-[color:var(--loss)]'
    : 'text-[color:var(--ink)] hover:bg-[color:var(--paper-2)]';

  return (
    <Link href={href} className={`${base} ${active ? activeCls : idleCls}`}>
      <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block font-medium">{label}</span>
        <span
          className={`block text-xs mt-0.5 ${
            active ? 'opacity-80' : 'text-[color:var(--ink-soft)]'
          }`}
        >
          {description}
        </span>
      </span>
    </Link>
  );
}
