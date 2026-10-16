'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  Plus,
  Upload,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { PortfolioStats } from './PortfolioStats';
import { AccountList } from './AccountList';
import { PositionsTable } from './PositionsTable';
import { TransactionsList } from './TransactionsList';
import { PaginatedTransactionsList } from './PaginatedTransactionsList';
import { DividendsTable } from './DividendsTable';
import { AccountAllocationChart, PositionPerformanceChart, PortfolioPerformanceChart, PortfolioValueChart } from './Charts';
import { PortfolioHistoryChart } from './PortfolioHistoryChart';
import { ProBlur } from './ProBlur';
import { UsageMeter, isNearLimit } from './UsageMeter';
import { ErrorBoundary } from './ErrorBoundary';
import { PanelSkeleton } from './Skeleton';
import { BenchmarkComparisonChart } from './BenchmarkComparisonChart';
import { PerformanceProjectionChart } from './PerformanceProjectionChart';
import { useSubscription } from '@/lib/subscription-client';
import { AddAccountModal } from './AddAccountModal';
import { AddTransactionModal } from './AddTransactionModal';
import { 
  useAccounts, 
  useTransactions, 
  useStockQuotes,
  usePortfolioSummary,
  usePortfolioHistory,
  useFullPortfolioHistory,
  useAccountsWithCalculatedValues,
  useAccountsYearToDateStats,
  useCurrentFxRates,
  usePositionsWithCalculatedValues
} from '@/lib/hooks';
import { accountSupportsPositions, formatDateTime } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import type { Transaction } from '@/lib/types';
import { DASHBOARD_TABS, navigateToDashboardTab, parseDashboardTab } from './app-shell/navigation';
import { PageContainer, PageHeader } from './app-shell/PageLayout';

// Passe à true une fois pour toutes : après le premier affichage, les
// rafraîchissements (cours, ajout d'opération) gardent les chiffres à l'écran
// au lieu de remontrer la silhouette de chargement.
const USAGE_GRID: Record<number, string> = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' };

/** Pastille des boutons d'import tant que l'import offert du plan Free reste disponible. */
function OfferedBadge() {
  return (
    <span className="rounded-full bg-[color:var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-medium leading-none text-[color:var(--accent)]">
      offert
    </span>
  );
}

function useReadyOnce(ready: boolean): boolean {
  const [latched, setLatched] = useState(ready);
  if (ready && !latched) setLatched(true);
  return latched || ready;
}

export function Dashboard() {
  // L'onglet actif vit dans l'URL (?tab=...) : il survit au rechargement,
  // se partage et suit le bouton retour du navigateur.
  // La navigation entre onglets est portée par la coque (AppShell).
  const searchParams = useSearchParams();
  const activeTab = parseDashboardTab(searchParams.get('tab'));
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [addTransactionDefaultAccountId, setAddTransactionDefaultAccountId] = useState<string | undefined>();
  const [addTransactionDefaultType, setAddTransactionDefaultType] = useState<Transaction['type'] | undefined>();
  const [lastUpdate, setLastUpdate] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [historyPeriod, setHistoryPeriod] = useState(30);
  const [txVersion, setTxVersion] = useState(0);
  // Filtre de compte sur l'onglet Positions. null = "Tous les comptes" (vue groupée).
  const [positionsAccountFilter, setPositionsAccountFilter] = useState<string | null>(null);

  const { isFree, limits, importAccess } = useSubscription();
  const canImportTransactions = importAccess.allowed;

  const { accounts, loading: loadingAccounts, refetch: refetchAccounts } = useAccounts();
  const { transactions, loading: loadingTransactions, refetch: refetchTransactions } = useTransactions();

  // Positions enrichies avec quantites calculees depuis les transactions
  const enrichedPositions = usePositionsWithCalculatedValues(transactions);
  const positionActivityAccountIds = useMemo(() => {
    const ids = new Set<string>();
    transactions.forEach((transaction) => {
      if (transaction.type === 'BUY' || transaction.type === 'SELL' || transaction.type === 'DIVIDEND') {
        ids.add(transaction.account_id);
      }
    });
    enrichedPositions.forEach((position) => {
      ids.add(position.account_id);
    });
    return ids;
  }, [transactions, enrichedPositions]);

  // Extraire les symboles pour les cotations (positions derivees + transactions)
  const symbols = useMemo(() => {
    const symbolSet = new Set<string>();

    enrichedPositions.forEach((position) => {
      if (position.symbol) {
        symbolSet.add(position.symbol.toUpperCase());
      }
    });

    transactions.forEach((transaction) => {
      if (transaction.stock_symbol) {
        symbolSet.add(transaction.stock_symbol.toUpperCase());
      }
    });

    return Array.from(symbolSet);
  }, [enrichedPositions, transactions]);
  const { quotes, ready: quotesReady, refetch: refetchQuotes } = useStockQuotes(symbols);
  // Taux du jour pour les montants en devises, quel que soit l'onglet ouvert.
  const { rates: currentFxRates, ready: currentFxReady } = useCurrentFxRates(transactions, accounts, quotes);

  // Historique du portefeuille (calculé dynamiquement)
  const { history: portfolioHistory, loading: loadingHistory, ready: historyReady } = usePortfolioHistory(
    transactions,
    accounts,
    historyPeriod,
    { enabled: activeTab === 'dashboard', quotes }
  );

  const enrichedAccounts = useAccountsWithCalculatedValues(accounts, transactions, enrichedPositions, quotes, currentFxRates);
  const {
    stats: accountsYearToDateStats,
    total: portfolioYearToDateStats,
    ready: yearToDateStatsReady,
  } = useAccountsYearToDateStats(
    enrichedAccounts,
    transactions,
    { enabled: activeTab === 'dashboard' || activeTab === 'accounts' }
  );
  const portfolioSummary = usePortfolioSummary(enrichedPositions, quotes, currentFxRates);
  // Calculer le total épargne (comptes non-actions)
  const savingsTotal = useMemo(() => {
    return enrichedAccounts
      .filter(a => !accountSupportsPositions(a))
      .reduce((sum, a) => sum + (a.calculatedTotalValueInBase ?? a.calculatedTotalValue), 0);
  }, [enrichedAccounts]);

  // Valeur globale du portefeuille = somme de tous les comptes (source de vérité unifiée)
  const totalPortfolioValue = useMemo(() => {
    return enrichedAccounts.reduce((sum, account) => {
      return sum + (account.calculatedTotalValueInBase ?? account.calculatedTotalValue);
    }, 0);
  }, [enrichedAccounts]);

  // Valeur de l'univers actions = positions + cash PEA/CTO
  // Comptes éligibles au filtre de l'onglet Positions (PEA/CTO uniquement)
  const stockAccounts = useMemo(() => {
    return enrichedAccounts.filter(accountSupportsPositions);
  }, [enrichedAccounts]);

  // Si le compte filtré n'existe plus (suppression), revenir à "Tous"
  const selectedPositionsAccountFilter =
    positionsAccountFilter && stockAccounts.some(a => a.id === positionsAccountFilter)
      ? positionsAccountFilter
      : null;

  // Données scopées à l'onglet Positions selon le filtre de compte
  const positionsScoped = useMemo(() => {
    if (!selectedPositionsAccountFilter) {
      const stockAccountIds = new Set(stockAccounts.map(a => a.id));
      return {
        positions: enrichedPositions.filter(p => stockAccountIds.has(p.account_id)),
        transactions: transactions.filter(t => stockAccountIds.has(t.account_id)),
        accounts: stockAccounts,
      };
    }
    return {
      positions: enrichedPositions.filter(p => p.account_id === selectedPositionsAccountFilter),
      transactions: transactions.filter(t => t.account_id === selectedPositionsAccountFilter),
      accounts: enrichedAccounts.filter(a => a.id === selectedPositionsAccountFilter),
    };
  }, [selectedPositionsAccountFilter, enrichedPositions, transactions, enrichedAccounts, stockAccounts]);

  // Historique complet du scope Positions (tous les comptes actions ou compte sélectionné).
  const {
    history: positionsFullPortfolioHistory,
    fxRates: positionsFxRates,
    fxReady: positionsFxReady,
    loading: loadingPositionsFullHistory,
  } = useFullPortfolioHistory(
    positionsScoped.transactions,
    positionsScoped.accounts,
    { enabled: activeTab === 'positions', quotes }
  );
  const latestPositionsPoint = positionsFullPortfolioHistory.length > 0
    ? positionsFullPortfolioHistory[positionsFullPortfolioHistory.length - 1]
    : null;

  // Résumé recalculé selon le scope (pour les KPIs des charts du tab Positions)
  const scopedPortfolioSummary = usePortfolioSummary(positionsScoped.positions, quotes, currentFxRates);
  const scopedStockCashTotal = useMemo(() => {
    return positionsScoped.accounts
      .filter(accountSupportsPositions)
      .reduce((sum, a) => sum + (a.calculatedCashInBase ?? a.calculatedCash ?? 0), 0);
  }, [positionsScoped.accounts]);
  const scopedStockPortfolioValue = latestPositionsPoint
    ? latestPositionsPoint.stocksValue
    : scopedPortfolioSummary.totalValue + scopedStockCashTotal;

  const refreshAllData = useCallback(async () => {
    const [nextAccounts, nextTransactions] = await Promise.all([
      refetchAccounts(),
      refetchTransactions(),
    ]);

    // Force les quotes à utiliser les symboles fraîchement récupérés.
    const nextSymbols = [...new Set(
      nextTransactions
        .map((transaction) => transaction.stock_symbol?.toUpperCase())
        .filter((symbol): symbol is string => Boolean(symbol))
    )];
    await refetchQuotes(nextSymbols);

    setLastUpdate(new Date());
    return { nextAccounts, nextTransactions };
  }, [refetchAccounts, refetchTransactions, refetchQuotes]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAllData();
    } finally {
      setRefreshing(false);
    }
  };

  const openAddTransaction = useCallback((
    defaults: { accountId?: string; type?: Transaction['type'] } = {}
  ) => {
    setAddTransactionDefaultAccountId(defaults.accountId);
    setAddTransactionDefaultType(defaults.type);
    setShowAddTransaction(true);
  }, []);

  // Unique point d'entrée post-mutation : refetch tout + bump txVersion pour
  // que la liste paginée (cursor-based, state local) reparte du curseur initial.
  const handleMutationSuccess = useCallback(async () => {
    setTxVersion(v => v + 1);
    await refreshAllData();
  }, [refreshAllData]);

  const isLoading = loadingAccounts || loadingTransactions;
  const isEmpty = !isLoading && accounts.length === 0;
  const nearLimits = [
    { label: 'Comptes', current: accounts.length, max: limits.maxAccounts },
    { label: 'Transactions', current: transactions.length, max: limits.maxTransactions },
    { label: 'Positions', current: enrichedPositions.length, max: limits.maxPositions },
  ].filter((usage) => isNearLimit(usage.current, usage.max));
  // Les montants ne s'affichent qu'une fois définitifs (comptes, opérations,
  // cours et taux du jour chargés) : sinon ils passent par 0 €, puis le PRU,
  // puis des devises non converties avant la vraie valeur.
  const valuesReady = useReadyOnce(!isLoading && quotesReady && currentFxReady);
  const yearToDateReady = useReadyOnce(valuesReady && yearToDateStatsReady);
  // Onglet Positions : plus-values réalisées converties au taux du jour de la vente.
  const positionsReady = useReadyOnce(valuesReady && positionsFxReady);
  // Courbe : au premier affichage, pas d'instantané en cache (partiel ou d'hier)
  // remplacé une seconde plus tard ; ensuite, un changement de période garde
  // l'ancienne courbe pendant le recalcul.
  // (Tant que les opérations chargent, l'historique « vide » ne compte pas.)
  const historyComputed = !isLoading && historyReady;
  const historyShown = useReadyOnce(historyComputed);

  const currentTab = DASHBOARD_TABS.find((tab) => tab.id === activeTab) ?? DASHBOARD_TABS[0];
  const busy = isLoading || refreshing;

  const refreshButton = (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={busy}
      className="inline-flex items-center justify-center rounded-lg border border-[color:var(--rule)] p-2 text-[color:var(--ink-soft)] transition-colors hover:bg-[color:var(--paper-2)] hover:text-[color:var(--ink)] disabled:opacity-50"
      title="Rafraîchir les données et les cours"
      aria-label="Rafraîchir les données et les cours"
    >
      <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
    </button>
  );

  const importButton = canImportTransactions ? (
    <Link
      href="/dashboard/import"
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 px-3.5 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      <Upload className="h-4 w-4" />
      <span>Importer</span>
      {importAccess.offered && <OfferedBadge />}
    </Link>
  ) : (
    <Link
      href="/dashboard/import"
      className="btn-outline inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm"
      title="Import offert déjà utilisé : imports illimités avec l’offre Pro"
    >
      <Lock className="h-4 w-4" />
      <span>Importer</span>
    </Link>
  );

  const primaryButtonClass = 'btn-ink inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm';

  // En-tête commun à toutes les sections : titre, contexte et actions de la section.
  const header = {
    dashboard: { description: undefined, actions: null },
    accounts: {
      description: 'Vos enveloppes : comptes titres, épargne, crypto.',
      actions: (
        <button type="button" onClick={() => setShowAddAccount(true)} className={primaryButtonClass}>
          <Plus className="h-4 w-4" />
          <span>Ajouter un compte</span>
        </button>
      ),
    },
    positions: {
      description: 'Ajoutez une position via une transaction d’achat.',
      actions: (
        <button
          type="button"
          onClick={() =>
            openAddTransaction({ accountId: selectedPositionsAccountFilter ?? undefined, type: 'BUY' })
          }
          className={primaryButtonClass}
        >
          <Plus className="h-4 w-4" />
          <span>Ajouter une position</span>
        </button>
      ),
    },
    transactions: {
      description: 'Historique complet de vos opérations.',
      actions: (
        <>
          {importButton}
          <button type="button" onClick={() => openAddTransaction()} className={primaryButtonClass}>
            <Plus className="h-4 w-4" />
            {/* Libellé court sur téléphone : Importer, Ajouter et Rafraîchir tiennent sur une ligne. */}
            <span className="sm:hidden">Ajouter</span>
            <span className="hidden sm:inline">Ajouter une transaction</span>
          </button>
        </>
      ),
    },
    dividends: { description: 'Ajoutez vos dividendes depuis la section Transactions.', actions: null },
  }[activeTab];

  return (
    <main className="overflow-x-hidden py-5 sm:py-8">
      <PageContainer>
        <PageHeader
          title={currentTab.title}
          description={header.description}
          meta={
            <p className="mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--ink-soft)]" suppressHydrationWarning>
              Mis à jour : {formatDateTime(lastUpdate)}
            </p>
          }
          actions={
            <>
              {header.actions}
              {refreshButton}
            </>
          }
        />

        {activeTab === 'dashboard' && isEmpty && (
          <GettingStarted
            canImport={canImportTransactions}
            importOffered={importAccess.offered}
            onAddAccount={() => setShowAddAccount(true)}
          />
        )}

        {activeTab === 'dashboard' && !isEmpty && (
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            {/* Limites de l'offre Free : seulement celles qui approchent (80 %). */}
            {isFree && nearLimits.length > 0 && (
              <div className={`grid gap-2 ${USAGE_GRID[nearLimits.length]}`}>
                {nearLimits.map((usage) => (
                  <UsageMeter key={usage.label} label={usage.label} current={usage.current} max={usage.max} />
                ))}
              </div>
            )}
            {/* Stats */}
            <ErrorBoundary label="Résumé du portefeuille">
              <PortfolioStats
                totalPortfolioValue={totalPortfolioValue}
                totalValue={portfolioSummary.totalValue}
                totalGain={portfolioSummary.totalGain}
                totalGainPercent={portfolioSummary.totalGainPercent}
                dayChange={portfolioSummary.dayChange}
                dayChangePercent={portfolioSummary.dayChangePercent}
                savingsTotal={savingsTotal}
                positions={enrichedPositions}
                accounts={accounts}
                quotes={quotes}
                yearToDate={portfolioYearToDateStats}
                loading={!valuesReady}
                yearToDateLoading={!yearToDateReady}
              />
            </ErrorBoundary>

            {/* Évolution par compte + répartition actuelle (mêmes couleurs par compte) */}
            {/* Les cartes sont directement les cellules de la grille : même hauteur par ligne. */}
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <ErrorBoundary label="Évolution du patrimoine">
                <ProBlur feature="advanced_analytics" label="Évolution du patrimoine — Pro">
                  <PortfolioHistoryChart
                    history={historyShown ? portfolioHistory : []}
                    accounts={accounts}
                    loading={loadingHistory || !historyComputed}
                    onPeriodChange={setHistoryPeriod}
                    selectedPeriod={historyPeriod}
                  />
                </ProBlur>
              </ErrorBoundary>
              <ErrorBoundary label="Répartition par compte">
                <AccountAllocationChart accounts={enrichedAccounts} loading={!valuesReady} />
              </ErrorBoundary>
            </div>

            {/* Quick Views - stack on mobile */}
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0 w-full max-w-full">
                <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 min-w-0">
                  <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    Mes comptes
                  </h2>
                  <button
                    onClick={() => setShowAddAccount(true)}
                    className="shrink-0 inline-flex items-center gap-1 text-xs sm:text-sm text-[color:var(--ink)] hover:underline underline-offset-4"
                    title="Ajouter un compte"
                    aria-label="Ajouter un compte"
                  >
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Ajouter</span>
                  </button>
                </div>
                <div className="w-full max-w-full overflow-hidden">
                  <ErrorBoundary label="Comptes">
                    <AccountList
                      accounts={enrichedAccounts}
                      yearToDateStats={accountsYearToDateStats}
                      loading={!valuesReady}
                      yearToDateLoading={!yearToDateReady}
                      positionActivityAccountIds={positionActivityAccountIds}
                      onChanged={handleMutationSuccess}
                    />
                  </ErrorBoundary>
                </div>
              </div>

              <div className="min-w-0 w-full max-w-full">
                <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 min-w-0">
                  <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    Dernières transactions
                  </h2>
                  <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                    <button
                      onClick={() => openAddTransaction()}
                      className="inline-flex items-center gap-1 text-xs sm:text-sm text-[color:var(--ink)] hover:underline underline-offset-4"
                      title="Ajouter une transaction"
                      aria-label="Ajouter une transaction"
                    >
                      <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Ajouter</span>
                    </button>
                  </div>
                </div>
                <div className="w-full max-w-full overflow-hidden">
                  <ErrorBoundary label="Dernières transactions">
                    <TransactionsList
                      transactions={transactions}
                      accounts={accounts}
                      limit={5}
                      onShowAll={() => navigateToDashboardTab('transactions')}
                      onDeleted={handleMutationSuccess}
                      onEdited={handleMutationSuccess}
                    />
                  </ErrorBoundary>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div>
            <AccountList
              accounts={enrichedAccounts}
              yearToDateStats={accountsYearToDateStats}
              loading={!valuesReady}
              yearToDateLoading={!yearToDateReady}
              positionActivityAccountIds={positionActivityAccountIds}
              onChanged={handleMutationSuccess}
            />
          </div>
        )}

        {activeTab === 'positions' && (
          <div className="space-y-4 sm:space-y-6">
            {stockAccounts.length > 1 && (
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-2 sm:p-3">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 px-2 shrink-0 hidden sm:inline">
                    Compte :
                  </span>
                  <button
                    onClick={() => setPositionsAccountFilter(null)}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedPositionsAccountFilter === null
                        ? 'bg-[color:var(--ink)] text-[color:var(--paper)]'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    Tous les comptes
                  </button>
                  {stockAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => setPositionsAccountFilter(account.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                        selectedPositionsAccountFilter === account.id
                          ? 'bg-[color:var(--ink)] text-[color:var(--paper)]'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {account.name}
                      <span className="ml-1.5 text-[10px] opacity-70">{account.type}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <ErrorBoundary label="Performance par position">
              {!positionsReady ? (
                <PanelSkeleton title="Vue d'ensemble des performances" rows={4} />
              ) : (
                <PositionPerformanceChart
                  positions={positionsScoped.positions}
                  quotes={quotes}
                  transactions={positionsScoped.transactions}
                  accounts={positionsScoped.accounts}
                  groupByAccount={selectedPositionsAccountFilter === null && stockAccounts.length > 1}
                  portfolioTotalValue={scopedPortfolioSummary.totalValue}
                  portfolioTotalInvested={scopedPortfolioSummary.totalInvested}
                  portfolioTotalGain={scopedPortfolioSummary.totalGain}
                  portfolioTotalGainPercent={scopedPortfolioSummary.totalGainPercent}
                  portfolioDayChange={scopedPortfolioSummary.dayChange}
                  portfolioDayChangePercent={scopedPortfolioSummary.dayChangePercent}
                  fxRates={positionsFxRates}
                />
              )}
            </ErrorBoundary>

            {/* Très grand écran : graphiques temporels deux par deux. */}
            <div className="grid gap-4 sm:gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <ErrorBoundary label="Valeur vs investissement">
                <PortfolioValueChart
                  history={positionsFullPortfolioHistory}
                  transactions={positionsScoped.transactions}
                  loading={loadingPositionsFullHistory || !positionsReady}
                  currentTotalValue={scopedPortfolioSummary.totalValue}
                  currentTotalInvested={scopedPortfolioSummary.totalInvested}
                  fxRates={positionsFxRates}
                />
              </ErrorBoundary>

              <ErrorBoundary label="Performance annuelle">
                <ProBlur feature="advanced_analytics" partial label="Performance annuelle — Pro">
                  <PortfolioPerformanceChart
                    transactions={positionsScoped.transactions}
                    portfolioHistory={positionsFullPortfolioHistory}
                    accounts={positionsScoped.accounts}
                    loading={loadingPositionsFullHistory || !positionsReady}
                    currentPortfolioValue={scopedStockPortfolioValue}
                    fxRates={positionsFxRates}
                  />
                </ProBlur>
              </ErrorBoundary>
            </div>

            <div className="grid gap-4 sm:gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <ErrorBoundary label="Comparaison benchmark">
                <ProBlur feature="advanced_analytics" partial label="Comparaison benchmark — Pro">
                  <BenchmarkComparisonChart
                    portfolioHistory={positionsFullPortfolioHistory}
                    transactions={positionsScoped.transactions}
                    loading={loadingPositionsFullHistory || !positionsReady}
                    currentPortfolioValue={scopedStockPortfolioValue}
                    fxRates={positionsFxRates}
                  />
                </ProBlur>
              </ErrorBoundary>

              <ErrorBoundary label="Projection du patrimoine">
                <PerformanceProjectionChart
                  history={positionsFullPortfolioHistory}
                  transactions={positionsScoped.transactions}
                  loading={loadingPositionsFullHistory || !positionsReady}
                  fxRates={positionsFxRates}
                />
              </ErrorBoundary>
            </div>

            <ErrorBoundary label="Tableau des positions">
              {!positionsReady ? (
                <PanelSkeleton title="Positions" rows={6} />
              ) : (
                <PositionsTable
                  positions={positionsScoped.positions}
                  quotes={quotes}
                  accounts={positionsScoped.accounts}
                  transactions={positionsScoped.transactions}
                  groupByAccount={selectedPositionsAccountFilter === null && stockAccounts.length > 1}
                  fxRates={positionsFxRates}
                />
              )}
            </ErrorBoundary>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div>
            <PaginatedTransactionsList
              accounts={accounts}
              pageSize={50}
              version={txVersion}
              onDeleted={handleMutationSuccess}
              onEdited={handleMutationSuccess}
            />
          </div>
        )}

        {activeTab === 'dividends' && (
          <div>
            {!valuesReady ? (
              <PanelSkeleton title="Dividendes" rows={5} />
            ) : (
              <DividendsTable
                transactions={transactions}
                positions={enrichedPositions}
                quotes={quotes}
                accounts={accounts}
              />
            )}
          </div>
        )}
      </PageContainer>

      {/* Modals */}
      <AddAccountModal
        isOpen={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onSuccess={handleMutationSuccess}
      />

      <AddTransactionModal
        isOpen={showAddTransaction}
        onClose={() => setShowAddTransaction(false)}
        onSuccess={handleMutationSuccess}
        accounts={accounts}
        positions={enrichedPositions}
        transactions={transactions}
        defaultAccountId={addTransactionDefaultAccountId}
        defaultType={addTransactionDefaultType}
      />
    </main>
  );
}

function GettingStarted({
  canImport,
  importOffered,
  onAddAccount,
}: {
  canImport: boolean;
  importOffered: boolean;
  onAddAccount: () => void;
}) {
  const steps = [
    {
      title: 'Créez votre premier compte',
      description: 'PEA, compte-titres, assurance-vie, livret… chaque enveloppe a son compte.',
    },
    {
      title: 'Saisissez vos opérations',
      description: 'Versements, achats, ventes et dividendes : Fi-Hub calcule vos positions et votre PRU.',
    },
    {
      title: 'Suivez votre patrimoine',
      description: 'Valeur totale, performance annuelle, répartition et historique se mettent à jour avec les cours.',
    },
  ];

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-8 shadow-sm">
      <p className="mono text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[color:var(--ink-soft)]">
        Bienvenue
      </p>
      <h2 className="display mt-2 text-3xl sm:text-4xl leading-tight text-[color:var(--ink)]">
        Votre patrimoine, en un coup d&apos;œil
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
        Commencez par ajouter un compte pour voir apparaître votre tableau de bord.
      </p>

      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4"
          >
            <span className="mono text-xs text-[color:var(--ink-soft)]">0{index + 1}</span>
            <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{step.title}</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{step.description}</p>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={onAddAccount}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 btn-ink rounded-lg text-sm sm:text-base"
        >
          <Plus className="h-4 w-4" />
          <span>Ajouter un compte</span>
        </button>
        {canImport ? (
          <Link
            href="/dashboard/import"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 btn-outline rounded-lg text-sm sm:text-base"
          >
            <Upload className="h-4 w-4" />
            <span>Importer un relevé</span>
            {importOffered && <OfferedBadge />}
          </Link>
        ) : (
          <Link
            href="/dashboard/import"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 btn-outline rounded-lg text-sm sm:text-base"
            title="Import offert déjà utilisé : imports illimités avec l’offre Pro"
          >
            <Lock className="h-4 w-4" />
            <span>Importer un relevé (Pro)</span>
          </Link>
        )}
      </div>
    </section>
  );
}
