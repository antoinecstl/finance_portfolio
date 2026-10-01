import { BarChart2, Coins, History, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';

// Sections du dashboard (onglets côté client, synchronisés avec ?tab=).
export type DashboardTab = 'dashboard' | 'accounts' | 'positions' | 'transactions' | 'dividends';

export const DASHBOARD_TABS: ReadonlyArray<{ id: DashboardTab; label: string; title: string; icon: LucideIcon }> = [
  { id: 'dashboard', label: 'Vue d’ensemble', title: 'Vue d’ensemble', icon: BarChart2 },
  { id: 'accounts', label: 'Comptes', title: 'Comptes', icon: Wallet },
  { id: 'positions', label: 'Positions', title: 'Positions', icon: TrendingUp },
  { id: 'transactions', label: 'Transactions', title: 'Transactions', icon: History },
  { id: 'dividends', label: 'Dividendes', title: 'Dividendes', icon: Coins },
];

export function parseDashboardTab(value: string | null): DashboardTab {
  return DASHBOARD_TABS.some((tab) => tab.id === value) ? (value as DashboardTab) : 'dashboard';
}

export function dashboardTabHref(tab: DashboardTab): string {
  return tab === 'dashboard' ? '/dashboard' : `/dashboard?tab=${tab}`;
}

/**
 * Change d'onglet sans aller-retour serveur : l'URL est mise à jour via
 * l'History API, que Next répercute dans useSearchParams.
 */
export function navigateToDashboardTab(tab: DashboardTab): void {
  const params = new URLSearchParams(window.location.search);
  if (tab === 'dashboard') params.delete('tab');
  else params.set('tab', tab);
  const query = params.toString();
  window.history.pushState(null, '', `/dashboard${query ? `?${query}` : ''}`);
  window.scrollTo({ top: 0 });
}
