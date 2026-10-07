'use client';

import { Suspense, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CandlestickChart, LogOut, Settings, ShieldCheck, Sparkles, Upload, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useSubscription } from '@/lib/subscription-client';
import {
  DASHBOARD_TABS,
  dashboardTabHref,
  navigateToDashboardTab,
  parseDashboardTab,
  type DashboardTab,
} from './navigation';

interface AppShellProps {
  children: ReactNode;
  email: string;
  isAdmin: boolean;
}

/**
 * Coque des pages connectées.
 * - À partir de 1280 px : barre latérale fixe (navigation complète, compte).
 *   En dessous, elle prendrait trop de largeur aux grilles du contenu.
 * - En dessous : barre du haut compacte + onglets des sections du patrimoine.
 */
export function AppShell({ children, email, isAdmin }: AppShellProps) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 xl:pl-60">
      <Suspense fallback={null}>
        <Sidebar email={email} isAdmin={isAdmin} />
        <MobileHeader />
      </Suspense>
      <div className="pb-10">{children}</div>
    </div>
  );
}

function useActiveDashboardTab(): DashboardTab | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return pathname === '/dashboard' ? parseDashboardTab(searchParams.get('tab')) : null;
}

function useSignOut() {
  const { signOut } = useAuth();
  const router = useRouter();
  return async () => {
    await signOut();
    router.push('/login');
    router.refresh();
  };
}

/** Lien vers un onglet du dashboard ; changement instantané si on y est déjà. */
function DashboardTabLink({
  tab,
  className,
  children,
  ariaCurrent,
}: {
  tab: DashboardTab;
  className: string;
  children: ReactNode;
  ariaCurrent: boolean;
}) {
  const pathname = usePathname();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (pathname !== '/dashboard' || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigateToDashboardTab(tab);
  };
  return (
    <Link href={dashboardTabHref(tab)} onClick={onClick} className={className} aria-current={ariaCurrent ? 'page' : undefined}>
      {children}
    </Link>
  );
}

const sidebarItemClass = (active: boolean) =>
  `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
    active
      ? 'bg-[color:var(--paper-2)] font-medium text-[color:var(--ink)] shadow-[inset_2px_0_0_var(--accent)]'
      : 'text-[color:var(--ink-soft)] hover:bg-[color:var(--paper-2)] hover:text-[color:var(--ink)]'
  }`;

function SidebarLink({ href, icon: Icon, label, active }: { href: string; icon: LucideIcon; label: string; active: boolean }) {
  return (
    <Link href={href} className={sidebarItemClass(active)} aria-current={active ? 'page' : undefined}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mono px-3 pb-1.5 pt-5 text-[10px] uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">{children}</p>
  );
}

function Sidebar({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const activeTab = useActiveDashboardTab();
  const { isFree } = useSubscription();
  const signOut = useSignOut();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[color:var(--rule)] bg-[color:var(--paper)] xl:flex">
      <div className="flex h-16 shrink-0 items-center px-6">
        <Link href="/dashboard" className="display text-2xl leading-none text-[color:var(--ink)] hover:opacity-80">
          Fi&#8209;Hub
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Navigation principale">
        <SectionLabel>Patrimoine</SectionLabel>
        <div className="space-y-0.5">
          {DASHBOARD_TABS.map((tab) => (
            <DashboardTabLink key={tab.id} tab={tab.id} ariaCurrent={activeTab === tab.id} className={sidebarItemClass(activeTab === tab.id)}>
              <tab.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{tab.label}</span>
            </DashboardTabLink>
          ))}
        </div>

        <SectionLabel>Analyse</SectionLabel>
        <div className="space-y-0.5">
          <SidebarLink href="/marches" icon={CandlestickChart} label="Marchés" active={pathname.startsWith('/marches')} />
        </div>

        <SectionLabel>Outils</SectionLabel>
        <div className="space-y-0.5">
          <SidebarLink href="/dashboard/import" icon={Upload} label="Importer un relevé" active={pathname === '/dashboard/import'} />
          <SidebarLink href="/settings" icon={Settings} label="Paramètres" active={pathname.startsWith('/settings')} />
          {isAdmin && <SidebarLink href="/admin" icon={ShieldCheck} label="Administration" active={pathname.startsWith('/admin')} />}
        </div>
      </nav>

      <div className="shrink-0 space-y-3 border-t border-[color:var(--rule)] p-3">
        {isFree && (
          <Link
            href="/settings/billing"
            className="flex items-center gap-2 rounded-lg border border-[color:var(--rule)] bg-[color:var(--paper-2)] px-3 py-2.5 text-sm text-[color:var(--ink)] hover:border-[color:var(--ink-soft)]"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-[color:var(--accent)]" aria-hidden="true" />
            <span>
              <span className="block font-medium">Passer Pro</span>
              <span className="block text-xs text-[color:var(--ink-soft)]">Comptes illimités, import, API</span>
            </span>
          </Link>
        )}
        <div className="flex items-center gap-2 px-1">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--ink)] text-xs font-medium uppercase text-[color:var(--paper)]"
            aria-hidden="true"
          >
            {email.slice(0, 1) || '?'}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-[color:var(--ink-soft)]" title={email}>
            {email}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg p-2 text-[color:var(--ink-soft)] transition-colors hover:bg-[color:var(--paper-2)] hover:text-[color:var(--ink)]"
            title="Déconnexion"
            aria-label="Déconnexion"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function MobileHeader() {
  const pathname = usePathname();
  const activeTab = useActiveDashboardTab();
  const { isFree } = useSubscription();
  const signOut = useSignOut();
  const iconButton =
    'p-2 rounded-lg text-[color:var(--ink-soft)] hover:bg-[color:var(--paper-2)] hover:text-[color:var(--ink)] transition-colors';

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--rule)] bg-[color:var(--paper)]/85 backdrop-blur-md xl:hidden">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" className="display text-2xl leading-none text-[color:var(--ink)]">
          Fi&#8209;Hub
        </Link>
        <div className="flex items-center gap-1">
          {isFree && (
            <Link href="/settings/billing" className="btn-ink mr-1 rounded-full px-3 py-1.5 text-xs font-medium">
              Pro
            </Link>
          )}
          <Link
            href="/marches"
            className={`${iconButton} ${pathname.startsWith('/marches') ? 'text-[color:var(--ink)]' : ''}`}
            title="Marchés"
            aria-label="Marchés"
          >
            <CandlestickChart className="h-5 w-5" />
          </Link>
          <Link
            href="/settings"
            className={`${iconButton} ${pathname.startsWith('/settings') ? 'text-[color:var(--ink)]' : ''}`}
            title="Paramètres"
            aria-label="Paramètres"
          >
            <Settings className="h-5 w-5" />
          </Link>
          <button type="button" onClick={signOut} className={iconButton} title="Déconnexion" aria-label="Déconnexion">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
      <nav
        className="grid grid-cols-5 border-t border-[color:var(--rule)]/70 sm:flex sm:gap-1 sm:px-4"
        aria-label="Sections du patrimoine"
      >
        {DASHBOARD_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <DashboardTabLink
              key={tab.id}
              tab={tab.id}
              ariaCurrent={active}
              className={`-mb-px flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 border-b-2 px-0.5 py-2 text-[11px] font-medium leading-tight transition-colors sm:min-h-0 sm:flex-row sm:gap-2 sm:px-3 sm:py-3 sm:text-sm ${
                active
                  ? 'border-[color:var(--accent)] text-[color:var(--ink)]'
                  : 'border-transparent text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]'
              }`}
            >
              <tab.icon className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
              <span className="max-w-full truncate sm:hidden">{tab.id === 'dashboard' ? 'Accueil' : tab.label}</span>
              <span className="hidden whitespace-nowrap sm:inline">{tab.label}</span>
            </DashboardTabLink>
          );
        })}
      </nav>
    </header>
  );
}
