// Classe d'actif et onglets de la fiche (docs/specs/explorateur-marches-v2.md §3).
// Partagé par le serveur et le client : aucune dépendance.

export type AssetClass = 'equity' | 'etf' | 'crypto' | 'index' | 'currency' | 'commodity' | 'other';

export function assetClassOf(instrumentType: string | null | undefined): AssetClass {
  switch ((instrumentType ?? '').toUpperCase()) {
    case 'EQUITY': return 'equity';
    case 'ETF':
    case 'MUTUALFUND': return 'etf';
    case 'CRYPTOCURRENCY': return 'crypto';
    case 'INDEX': return 'index';
    case 'CURRENCY': return 'currency';
    case 'FUTURE': return 'commodity';
    default: return 'other';
  }
}

export type MarketTab = 'apercu' | 'performance' | 'finances' | 'valorisation' | 'profil' | 'composition' | 'marche';

export const TAB_LABELS: Record<MarketTab, string> = {
  apercu: 'Aperçu',
  performance: 'Performance',
  finances: 'Finances',
  valorisation: 'Valorisation',
  profil: 'Profil',
  composition: 'Composition',
  marche: 'Marché',
};

const TABS: Record<AssetClass, MarketTab[]> = {
  equity: ['apercu', 'performance', 'finances', 'valorisation', 'profil'],
  etf: ['apercu', 'performance', 'composition'],
  crypto: ['apercu', 'performance', 'marche'],
  index: ['apercu', 'performance'],
  currency: ['apercu', 'performance'],
  commodity: ['apercu', 'performance'],
  other: ['apercu', 'performance'],
};

export function tabsFor(assetClass: AssetClass): MarketTab[] {
  return TABS[assetClass];
}

/** Onglet demandé dans l'URL s'il existe pour cet actif, sinon l'aperçu. */
export function resolveTab(assetClass: AssetClass, requested: string | null | undefined): MarketTab {
  const tabs = tabsFor(assetClass);
  return tabs.includes(requested as MarketTab) ? (requested as MarketTab) : 'apercu';
}

/** Cotation continue (volatilité annualisée sur 365 jours). */
export function tradesAroundTheClock(assetClass: AssetClass): boolean {
  return assetClass === 'crypto';
}
