'use client';

// Onglet Profil d'une action (docs/specs/explorateur-marches-v2.md §4.4).

import { CompanyFacts, Profile, useFundamentals } from './MarketFundamentals';
import { Panel, PanelError, PanelSkeleton, StaleNotice } from './ui';

export function ProfilePanel({ symbol, priceCurrency }: { symbol: string; priceCurrency: string }) {
  const fundamentals = useFundamentals(symbol);
  if (fundamentals.error) {
    return <PanelError title="Profil" message="Profil momentanément indisponible." onRetry={fundamentals.reload} />;
  }
  if (!fundamentals.data) return <PanelSkeleton title="Profil" height={160} />;
  const summary = fundamentals.data.available ? fundamentals.data.summary : null;
  if (!summary) return <PanelError title="Profil" message="Pas de profil publié pour ce titre." />;
  return (
    <div className="space-y-4 sm:space-y-6">
      <StaleNotice asOf={fundamentals.data.asOf} stale={fundamentals.data.stale} />
      <Panel id="profile" title="Activité">
        <Profile summary={summary} />
      </Panel>
      <Panel id="facts" title="Calendrier, risque et actionnariat" description="Bêta : sensibilité du cours aux mouvements du marché (1 = comme le marché).">
        <CompanyFacts summary={summary} priceCurrency={priceCurrency} />
      </Panel>
    </div>
  );
}
