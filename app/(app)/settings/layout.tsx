import { PageContainer, PageHeader } from '@/components/app-shell/PageLayout';
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
  { href: '/settings/api', label: 'Accès API', description: 'ChatGPT, Claude, jetons', icon: 'api' },
  { href: '/settings/danger', label: 'Zone danger', description: 'Export, suppression', icon: 'danger', danger: true },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="py-5 text-[color:var(--ink)] sm:py-8">
      <PageContainer>
        <PageHeader title="Paramètres" description="Gérez votre compte, votre abonnement et vos préférences." />

        {/* Formulaires : largeur de lecture limitée, alignée à gauche avec le reste de l'app. */}
        <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-[240px_minmax(0,56rem)] lg:gap-8">
          <aside>
            <nav
              aria-label="Paramètres"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide sm:-mx-6 sm:px-6 md:sticky md:top-6 md:mx-0 md:block md:space-y-1 md:overflow-visible md:px-0 md:pb-0"
            >
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

          <section className="ink-card rounded-2xl pop-shadow p-4 sm:p-8">
            {children}
          </section>
        </div>
      </PageContainer>
    </main>
  );
}
