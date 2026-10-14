'use client';

// Onglets Composition (ETF, fonds) et Marché (crypto) — docs/specs/explorateur-marches-v2.md §4.5-4.6.

import Link from 'next/link';
import type { DetailsPayload } from '@/lib/market/services/details';
import { fmtCompact, fmtMoneyCompact, fmtMultiple, fmtPct, fmtPrice, fmtShare, marketHref, changeClass } from './format';
import { Figure, fmtDate, Panel, PanelError, PanelSkeleton, StaleNotice } from './ui';
import { useJson } from './useJson';

type DetailsResponse = Extract<DetailsPayload, { found: true }> & { asOf: string; stale: boolean };

function useDetails(symbol: string) {
  return useJson<DetailsResponse>(`/api/market/details?symbol=${encodeURIComponent(symbol)}`);
}

/** Barres horizontales de parts (lignes, secteurs, répartition) : une couleur, le libellé dans le texte. */
function ShareBars({ rows }: { rows: Array<{ key: string; label: React.ReactNode; weight: number }> }) {
  const max = Math.max(...rows.map((r) => r.weight), 0.0001);
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
          <span className="truncate text-zinc-800 dark:text-zinc-200">{r.label}</span>
          <span className="tabular-nums text-zinc-900 dark:text-zinc-100">{fmtShare(r.weight, 1)}</span>
          <span className="col-span-2 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden="true">
            <span className="block h-1.5 rounded-full bg-[color:var(--chart-1)]" style={{ width: `${(r.weight / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function EtfCompositionPanel({ symbol }: { symbol: string }) {
  const details = useDetails(symbol);
  if (details.error) return <PanelError title="Composition" message={details.error === 'not_found' ? 'Fonds introuvable.' : 'Composition momentanément indisponible.'} onRetry={details.reload} />;
  if (!details.data) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <PanelSkeleton title="Identité du fonds" height={120} />
        <PanelSkeleton title="Principales lignes" height={240} />
      </div>
    );
  }
  const etf = details.data.etf;
  if (!etf) return <PanelError title="Composition" message="Composition non publiée pour ce fonds. Les onglets Aperçu et Performance restent disponibles." />;
  const { profile, portfolioMultiples: pm } = etf;
  const age = profile.inceptionDate ? new Date().getUTCFullYear() - Number(profile.inceptionDate.slice(0, 4)) : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <StaleNotice asOf={details.data.asOf} stale={details.data.stale} />
      <Panel id="etf-profile" title="Identité du fonds">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {profile.category && <Figure label="Catégorie" value={<span className="text-sm">{profile.category}</span>} />}
          {profile.family && <Figure label="Société de gestion" value={<span className="text-sm">{profile.family}</span>} />}
          {profile.expenseRatio !== null && (
            <Figure label="Frais courants (par an)" value={fmtShare(profile.expenseRatio, 2)} hint="Prélevés chaque année sur l’encours, déjà déduits du cours." />
          )}
          {profile.totalAssets !== null && <Figure label="Encours" value={fmtMoneyCompact(profile.totalAssets, details.data.currency)} />}
          {profile.inceptionDate && <Figure label="Création" value={fmtDate(profile.inceptionDate)} detail={age !== null && age > 0 ? `${age} an${age > 1 ? 's' : ''} d’historique` : undefined} />}
          {profile.distributionYield !== null && profile.distributionYield > 0 && (
            <Figure label="Rendement distribué" value={fmtShare(profile.distributionYield, 2)} hint="Distributions des 12 derniers mois / cours. 0 pour un ETF capitalisant." />
          )}
        </dl>
      </Panel>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {etf.holdings.length > 0 && (
          <Panel id="etf-holdings" title="Principales lignes" description={`Les ${etf.holdings.length} premières lignes pèsent ${fmtShare(etf.holdings.reduce((a, h) => a + h.weight, 0), 0)} du fonds.`}>
            <ShareBars
              rows={etf.holdings.map((h) => ({
                key: `${h.symbol ?? ''}${h.name}`,
                weight: h.weight,
                label: h.symbol ? <Link href={marketHref(h.symbol)} className="underline-offset-4 hover:underline">{h.name}</Link> : h.name,
              }))}
            />
          </Panel>
        )}
        {etf.sectors.length > 0 && (
          <Panel id="etf-sectors" title="Secteurs">
            <ShareBars rows={etf.sectors.map((s) => ({ key: s.key, label: s.label, weight: s.weight }))} />
          </Panel>
        )}
        {etf.allocation.length > 0 && (
          <Panel id="etf-allocation" title="Répartition par classe d’actifs">
            <ShareBars rows={etf.allocation.map((a) => ({ key: a.key, label: a.label, weight: a.weight }))} />
          </Panel>
        )}
        {(pm.per !== null || pm.priceToBook !== null) && (
          <Panel id="etf-multiples" title="Valorisation des titres détenus" description="Moyennes publiées pour le portefeuille du fonds.">
            <dl className="grid grid-cols-2 gap-2">
              {pm.per !== null && <Figure label="PER" value={fmtMultiple(pm.per)} />}
              {pm.priceToBook !== null && <Figure label="Cours / actif net" value={fmtMultiple(pm.priceToBook)} />}
              {pm.priceToSales !== null && <Figure label="Cours / CA" value={fmtMultiple(pm.priceToSales)} />}
              {pm.priceToCashflow !== null && <Figure label="Cours / flux de trésorerie" value={fmtMultiple(pm.priceToCashflow)} />}
            </dl>
          </Panel>
        )}
      </div>

      {etf.risk.length > 0 && (
        <Panel id="etf-risk" title="Risque publié" description="Bêta : sensibilité au marché de référence (1 = comme lui). Sharpe : rendement obtenu par unité de risque.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  <th scope="col" className="py-2 pr-3 text-left font-medium">Période</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Volatilité</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Bêta</th>
                  <th scope="col" className="py-2 pl-2 text-right font-medium">Sharpe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 tabular-nums dark:divide-zinc-800">
                {etf.risk.map((r) => (
                  <tr key={r.period}>
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal text-zinc-600 dark:text-zinc-300">{r.period.replace('y', ' ans')}</th>
                    <td className="px-2 py-1.5 text-right text-zinc-900 dark:text-zinc-100">{fmtShare(r.volatility, 1)}</td>
                    <td className="px-2 py-1.5 text-right text-zinc-900 dark:text-zinc-100">{r.beta !== null ? r.beta.toFixed(2).replace('.', ',') : '—'}</td>
                    <td className="py-1.5 pl-2 text-right text-zinc-900 dark:text-zinc-100">{r.sharpe !== null ? r.sharpe.toFixed(2).replace('.', ',') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

function correlationWord(value: number): string {
  const a = Math.abs(value);
  const strength = a >= 0.7 ? 'forte' : a >= 0.4 ? 'modérée' : 'faible';
  return value < 0 ? `${strength}, de sens opposé` : strength;
}

export function CryptoMarketPanel({ symbol }: { symbol: string }) {
  const details = useDetails(symbol);
  if (details.error) return <PanelError title="Marché" message={details.error === 'not_found' ? 'Actif introuvable.' : 'Données de marché momentanément indisponibles.'} onRetry={details.reload} />;
  if (!details.data) return <PanelSkeleton title="Marché et offre" height={220} />;
  const crypto = details.data.crypto;
  if (!crypto) return <PanelError title="Marché" message="Pas de données de marché publiées pour cet actif." />;
  const currency = details.data.currency;
  const startYear = crypto.startDate ? Number(crypto.startDate.slice(0, 4)) : null;
  const age = startYear ? new Date().getUTCFullYear() - startYear : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <StaleNotice asOf={details.data.asOf} stale={details.data.stale} />
      <Panel id="crypto-market" title="Marché">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {crypto.marketCap !== null && <Figure label="Capitalisation" value={fmtMoneyCompact(crypto.marketCap, currency)} hint="Cours × unités en circulation." />}
          {crypto.volume24h !== null && (
            <Figure
              label="Volume sur 24 h"
              value={fmtMoneyCompact(crypto.volume24h, currency)}
              detail={crypto.volumeToMarketCap !== null ? `${fmtShare(crypto.volumeToMarketCap, 1)} de la capitalisation` : undefined}
              hint="Montant échangé sur une journée : plus il est élevé, plus il est facile d’acheter ou vendre."
            />
          )}
          {crypto.allTimeHigh && (
            <Figure
              label="Plus haut historique"
              value={fmtPrice(crypto.allTimeHigh.value, currency)}
              detail={`le ${fmtDate(crypto.allTimeHigh.date)}`}
              hint={crypto.allTimeHigh.distance !== null ? `Cours actuel : ${fmtPct(crypto.allTimeHigh.distance, 1)} par rapport à ce sommet.` : undefined}
            />
          )}
          {crypto.fullyDilutedValue !== null && (
            <Figure label="Capitalisation diluée" value={fmtMoneyCompact(crypto.fullyDilutedValue, currency)} hint="Cours × offre maximale : la valeur si toutes les unités existaient déjà." />
          )}
          {startYear && <Figure label="Création" value={String(startYear)} detail={age !== null && age > 0 ? `${age} an${age > 1 ? 's' : ''} d’existence` : undefined} />}
          {crypto.algorithm && <Figure label="Algorithme" value={<span className="text-sm">{crypto.algorithm}</span>} />}
        </dl>
      </Panel>

      {crypto.circulatingSupply !== null && (
        <Panel id="crypto-supply" title="Offre" description="Nombre d’unités en circulation et plafond prévu par le protocole, quand il existe.">
          <p className="text-sm text-zinc-900 dark:text-zinc-100">
            <span className="font-semibold">{fmtCompact(crypto.circulatingSupply)}</span> en circulation
            {crypto.maxSupply !== null ? <> sur <span className="font-semibold">{fmtCompact(crypto.maxSupply)}</span> au maximum</> : ' · pas de plafond publié'}
          </p>
          {crypto.issuedShare !== null && (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(crypto.issuedShare * 100)} aria-label="Part de l’offre maximale déjà émise">
                <div className="h-2 rounded-full bg-[color:var(--chart-1)]" style={{ width: `${crypto.issuedShare * 100}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{fmtShare(crypto.issuedShare, 1)} de l’offre maximale déjà émise.</p>
            </div>
          )}
        </Panel>
      )}

      {crypto.correlation && (
        <Panel id="crypto-correlation" title={`Lien avec ${crypto.correlation.label === 'Bitcoin' ? 'le bitcoin' : 'le S&P 500'}`}>
          <p className="text-sm text-zinc-900 dark:text-zinc-100">
            Corrélation des variations quotidiennes sur 1 an :{' '}
            <span className={`font-semibold ${changeClass(0)}`}>{crypto.correlation.value.toFixed(2).replace('.', ',')}</span>{' '}
            <span className="text-zinc-600 dark:text-zinc-300">({correlationWord(crypto.correlation.value)})</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            1 : les deux montent et baissent ensemble ; 0 : aucun lien ; −1 : en sens opposé. Une corrélation forte limite l’intérêt de diversification.
          </p>
        </Panel>
      )}

      {crypto.description && (
        <Panel id="crypto-about" title="À propos">
          <details className="text-xs text-zinc-600 dark:text-zinc-400">
            <summary className="cursor-pointer select-none">Description (en anglais)</summary>
            <p className="mt-1 leading-relaxed" lang="en">{crypto.description}</p>
          </details>
        </Panel>
      )}
    </div>
  );
}
