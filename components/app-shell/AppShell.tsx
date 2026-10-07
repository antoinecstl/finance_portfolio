'use client';

import { Suspense, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CandlestickChart,
  ChevronRight,
  CreditCard,
  KeyRound,
  Lock,
  LogOut,
  Menu,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useSubscription } from '@/lib/subscription-client';
import {
  DASHBOARD_GROUPS,
  DASHBOARD_TABS,
  dashboardGroupOf,
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
 * Coque des pages connectées. Même organisation sur tous les écrans :
 * Accueil · Portefeuille (positions, comptes) · Activité (transactions,
 * dividendes) · Marchés, puis les outils et le compte.
 * - À partir de 1280 px : barre latérale fixe.
 * - En dessous : barre d'onglets en bas de l'écran (à portée de pouce), barre
 *   du haut réduite au logo, sous-onglets quand une rubrique a deux pages, et
 *   un menu « Plus » pour l'import, les paramètres et la déconnexion.
 */
export function AppShell({ children, email, isAdmin }: AppShellProps) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 xl:pl-60">
      <Suspense fallback={null}>
        <Sidebar email={email} isAdmin={isAdmin} />
        <MobileHeader />
        <MobileTabBar email={email} isAdmin={isAdmin} />
      </Suspense>
      {/* Sur mobile, on réserve la hauteur de la barre du bas (et de la zone d'accueil iPhone). */}
      <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] xl:pb-10">{children}</div>
    </div>
  );
}

/** Pages du compte, accessibles depuis le menu « Plus » (mobile) ou Paramètres. */
const ACCOUNT_LINKS: ReadonlyArray<{ href: string; label: string; icon: LucideIcon; danger?: boolean }> = [
  { href: '/settings/profile', label: 'Profil', icon: User },
  { href: '/settings/billing', label: 'Abonnement', icon: CreditCard },
  { href: '/settings/security', label: 'Sécurité', icon: Shield },
  { href: '/settings/api', label: 'Accès API (ChatGPT, Claude)', icon: KeyRound },
  { href: '/settings/danger', label: 'Export et suppression', icon: AlertTriangle, danger: true },
];

const isToolPath = (pathname: string) =>
  pathname.startsWith('/settings') || pathname.startsWith('/admin') || pathname === '/dashboard/import';

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
        {DASHBOARD_GROUPS.map((group) => (
          <div key={group.id}>
            {group.tabs.length > 1 && <SectionLabel>{group.label}</SectionLabel>}
            <div className={`space-y-0.5 ${group.tabs.length > 1 ? '' : 'pt-2'}`}>
              {group.tabs.map((t) => {
                const tab = DASHBOARD_TABS.find((d) => d.id === t.id)!;
                return (
                  <DashboardTabLink key={t.id} tab={t.id} ariaCurrent={activeTab === t.id} className={sidebarItemClass(activeTab === t.id)}>
                    <tab.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{t.label}</span>
                  </DashboardTabLink>
                );
              })}
            </div>
          </div>
        ))}

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
          <Avatar email={email} />
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

function Avatar({ email }: { email: string }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--ink)] text-xs font-medium uppercase text-[color:var(--paper)]"
      aria-hidden="true"
    >
      {email.slice(0, 1) || '?'}
    </span>
  );
}

/**
 * Barre du haut (mobile et tablette) : le logo, l'accès Pro, et les
 * sous-onglets de la rubrique en cours (Positions | Comptes, Transactions | Dividendes).
 */
function MobileHeader() {
  const activeTab = useActiveDashboardTab();
  const { isFree } = useSubscription();
  const group = activeTab ? dashboardGroupOf(activeTab) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--rule)] bg-[color:var(--paper)]/90 backdrop-blur-md xl:hidden">
      <div className="flex h-12 items-center justify-between px-4 sm:h-14 sm:px-6">
        <Link href="/dashboard" className="display text-[1.4rem] leading-none text-[color:var(--ink)] sm:text-2xl">
          Fi&#8209;Hub
        </Link>
        {isFree && (
          <Link href="/settings/billing" className="btn-ink inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Passer Pro
          </Link>
        )}
      </div>
      {group && group.tabs.length > 1 && (
        <nav className="px-4 pb-2.5 sm:px-6" aria-label={group.label}>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-[color:var(--paper-2)] p-1 sm:inline-grid sm:min-w-[22rem]">
            {group.tabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <DashboardTabLink
                  key={t.id}
                  tab={t.id}
                  ariaCurrent={active}
                  className={`rounded-lg px-3 py-1.5 text-center text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[color:var(--paper)] text-[color:var(--ink)] shadow-sm'
                      : 'text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]'
                  }`}
                >
                  {t.label}
                </DashboardTabLink>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}

const tabBarItemClass = (active: boolean) =>
  `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium leading-tight transition-colors ${
    active ? 'text-[color:var(--ink)]' : 'text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]'
  }`;

function ActiveDot({ active }: { active: boolean }) {
  return (
    <span
      className={`absolute top-0 h-0.5 w-8 rounded-full bg-[color:var(--accent)] transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`}
      aria-hidden="true"
    />
  );
}

/** Barre d'onglets du bas (mobile et tablette). */
function MobileTabBar({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const activeTab = useActiveDashboardTab();
  const activeGroup = activeTab ? dashboardGroupOf(activeTab).id : null;
  const [menuOpen, setMenuOpen] = useState(false);
  const moreActive = menuOpen || isToolPath(pathname);

  return (
    <>
      <nav
        data-bottom-nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--rule)] bg-[color:var(--paper)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md xl:hidden"
        aria-label="Navigation principale"
      >
        <div className="mx-auto flex max-w-xl">
          {DASHBOARD_GROUPS.map((group) => {
            const active = activeGroup === group.id && !menuOpen;
            const target = group.tabs[0].id;
            return (
              <DashboardTabLink key={group.id} tab={target} ariaCurrent={active} className={tabBarItemClass(active)}>
                <ActiveDot active={active} />
                <group.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                <span className="max-w-full truncate">{group.label}</span>
              </DashboardTabLink>
            );
          })}
          <Link
            href="/marches"
            className={tabBarItemClass(pathname.startsWith('/marches') && !menuOpen)}
            aria-current={pathname.startsWith('/marches') ? 'page' : undefined}
          >
            <ActiveDot active={pathname.startsWith('/marches') && !menuOpen} />
            <CandlestickChart className="h-[22px] w-[22px]" strokeWidth={pathname.startsWith('/marches') ? 2.2 : 1.8} aria-hidden="true" />
            <span>Marchés</span>
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className={tabBarItemClass(moreActive)}
            aria-expanded={menuOpen}
            aria-controls="mobile-more-menu"
          >
            <ActiveDot active={moreActive} />
            <Menu className="h-[22px] w-[22px]" strokeWidth={moreActive ? 2.2 : 1.8} aria-hidden="true" />
            <span>Plus</span>
          </button>
        </div>
      </nav>
      {menuOpen && <MoreSheet email={email} isAdmin={isAdmin} onClose={() => setMenuOpen(false)} />}
    </>
  );
}

/** Menu « Plus » : import, compte et paramètres, administration, déconnexion. */
function MoreSheet({ email, isAdmin, onClose }: { email: string; isAdmin: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { isFree, hasFeature } = useSubscription();
  const signOut = useSignOut();
  const panelRef = useRef<HTMLDivElement>(null);
  const canImport = hasFeature('import_transactions');

  // Fermeture à Échap, défilement de la page bloqué, focus placé dans le menu.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);

  const row = (active: boolean, danger = false) =>
    `flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] transition-colors ${
      active ? 'bg-[color:var(--paper-2)] font-medium text-[color:var(--ink)]' : danger ? 'text-[color:var(--loss)]' : 'text-[color:var(--ink)]'
    } hover:bg-[color:var(--paper-2)]`;

  return (
    <div className="fixed inset-0 z-50 xl:hidden">
      <button type="button" className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Fermer le menu" tabIndex={-1} />
      <div
        id="mobile-more-menu"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Plus"
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-[color:var(--rule)] bg-[color:var(--paper)] px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 shadow-2xl outline-none"
      >
        <div className="mx-auto max-w-xl">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[color:var(--rule)]" aria-hidden="true" />
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar email={email} />
            <span className="min-w-0 flex-1 truncate text-sm text-[color:var(--ink-soft)]">{email}</span>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-[color:var(--ink-soft)] hover:bg-[color:var(--paper-2)]" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>
          </div>

          {isFree && (
            <Link
              href="/settings/billing"
              onClick={onClose}
              className="mx-1 mt-1 flex items-center gap-3 rounded-xl border border-[color:var(--rule)] bg-[color:var(--paper-2)] px-3 py-3 text-[color:var(--ink)]"
            >
              <Sparkles className="h-5 w-5 shrink-0 text-[color:var(--accent)]" aria-hidden="true" />
              <span className="flex-1">
                <span className="block text-[15px] font-medium">Passer Pro</span>
                <span className="block text-xs text-[color:var(--ink-soft)]">Comptes illimités, import de relevés, API</span>
              </span>
              <ChevronRight className="h-4 w-4 text-[color:var(--ink-soft)]" aria-hidden="true" />
            </Link>
          )}

          <p className="mono px-3 pb-1 pt-4 text-[10px] uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">Outils</p>
          <Link href={canImport ? '/dashboard/import' : '/settings/billing'} onClick={onClose} className={row(pathname === '/dashboard/import')}>
            <Upload className="h-5 w-5 shrink-0 text-[color:var(--ink-soft)]" aria-hidden="true" />
            <span className="flex-1">Importer un relevé</span>
            {!canImport && <Lock className="h-4 w-4 text-[color:var(--ink-soft)]" aria-label="Offre Pro" />}
          </Link>
          {isAdmin && (
            <Link href="/admin" onClick={onClose} className={row(pathname.startsWith('/admin'))}>
              <ShieldCheck className="h-5 w-5 shrink-0 text-[color:var(--ink-soft)]" aria-hidden="true" />
              <span className="flex-1">Administration</span>
            </Link>
          )}

          <p className="mono px-3 pb-1 pt-4 text-[10px] uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">Compte et paramètres</p>
          {ACCOUNT_LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={onClose} className={row(pathname === link.href, link.danger)}>
              <link.icon className={`h-5 w-5 shrink-0 ${link.danger ? '' : 'text-[color:var(--ink-soft)]'}`} aria-hidden="true" />
              <span className="flex-1">{link.label}</span>
              <ChevronRight className="h-4 w-4 text-[color:var(--ink-soft)]" aria-hidden="true" />
            </Link>
          ))}

          <div className="mt-3 border-t border-[color:var(--rule)] pt-2">
            <button type="button" onClick={() => { onClose(); void signOut(); }} className={`${row(false)} w-full`}>
              <LogOut className="h-5 w-5 shrink-0 text-[color:var(--ink-soft)]" aria-hidden="true" />
              <span className="flex-1 text-left">Déconnexion</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
