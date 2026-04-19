import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SettingsNavItem, type SettingsIconKey } from './SettingsNavItem';

const tabs: {
  href: string;
  label: string;
  description: string;
  icon: SettingsIconKey;
  danger?: boolean;
}[] = [
  { href: '/settings/profile', label: 'Profil', description: 'Nom, préférences email', icon: 'user' },
  { href: '/settings/billing', label: 'Abonnement', description: 'Plan, facturation', icon: 'billing' },
  { href: '/settings/security', label: 'Sécurité', description: 'Mot de passe', icon: 'shield' },
  { href: '/settings/danger', label: 'Zone danger', description: 'Export, suppression', icon: 'danger', danger: true },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Paramètres
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Gérez votre compte, votre abonnement et vos préférences.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-8">
          <aside>
            <nav className="space-y-1 md:sticky md:top-6">
              {tabs.map((t) => (
                <SettingsNavItem
                  key={t.href}
                  href={t.href}
                  label={t.label}
                  description={t.description}
                  icon={t.icon}
                  danger={t.danger}
                />
              ))}
            </nav>
          </aside>

          <main className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 sm:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
