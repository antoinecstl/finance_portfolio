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
    <div className="min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)]">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[color:var(--ink-soft)] hover:text-[color:var(--accent)] mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au dashboard
        </Link>

        <div className="mb-8">
          <h1 className="display text-4xl leading-none text-[color:var(--ink)]">
            Paramètres
          </h1>
          <p className="text-sm text-[color:var(--ink-soft)] mt-2">
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

          <main className="ink-card rounded-2xl pop-shadow p-6 sm:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
