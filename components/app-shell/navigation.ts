import { ArrowLeftRight, BarChart2, Coins, History, House, PieChart, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';

// Sections du dashboard (onglets côté client, synchronisés avec ?tab=).
export type DashboardTab = 'dashboard' | 'accounts' | 'positions' | 'transactions' | 'dividends';

export const DASHBOARD_TABS: ReadonlyArray<{ id: DashboardTab; label: string; title: string; icon: LucideIcon }> = [
  { id: 'dashboard', label: 'Vue d’ensemble', title: 'Vue d’ensemble', icon: BarChart2 },
  { id: 'accounts', label: 'Comptes', title: 'Comptes', icon: Wallet },
  { id: 'positions', label: 'Positions', title: 'Positions', icon: TrendingUp },
  { id: 'transactions', label: 'Transactions', title: 'Transactions', icon: History },
  { id: 'dividends', label: 'Dividendes', title: 'Dividendes', icon: Coins },
];

/**
 * Regroupement des sections pour la navigation principale (barre du bas sur
 * mobile, rubriques de la barre latérale) :
 * - Accueil : la vue d'ensemble ;
 * - Portefeuille : ce que l'on possède (positions, puis les comptes qui les portent) ;
 * - Activité : ce qui s'est passé (opérations saisies, dividendes reçus).
 * Chaque section garde son onglet et son URL (?tab=…) : rien ne change pour les liens existants.
 */
export type DashboardGroupId = 'home' | 'portfolio' | 'activity';

export const DASHBOARD_GROUPS: ReadonlyArray<{
  id: DashboardGroupId;
  label: string;
  icon: LucideIcon;
  tabs: ReadonlyArray<{ id: DashboardTab; label: string }>;
}> = [
  { id: 'home', label: 'Accueil', icon: House, tabs: [{ id: 'dashboard', label: 'Vue d’ensemble' }] },
  { id: 'portfolio', label: 'Portefeuille', icon: PieChart, tabs: [{ id: 'positions', label: 'Positions' }, { id: 'accounts', label: 'Comptes' }] },
  { id: 'activity', label: 'Activité', icon: ArrowLeftRight, tabs: [{ id: 'transactions', label: 'Transactions' }, { id: 'dividends', label: 'Dividendes' }] },
];

export function dashboardGroupOf(tab: DashboardTab) {
  return DASHBOARD_GROUPS.find((group) => group.tabs.some((t) => t.id === tab)) ?? DASHBOARD_GROUPS[0];
}

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
