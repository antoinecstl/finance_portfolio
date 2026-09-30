'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  Plus,
  Wallet,
  BarChart2,
  History,
  TrendingUp,
  LogOut,
  Settings,
  Coins,
  Upload,
  Lock,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { PortfolioStats } from './PortfolioStats';
import { AccountList } from './AccountList';
import { PositionsTable } from './PositionsTable';
import { TransactionsList } from './TransactionsList';
import { PaginatedTransactionsList } from './PaginatedTransactionsList';
import { DividendsTable } from './DividendsTable';
import { AllocationChart, AccountAllocationChart, PortfolioHistoryChart, PositionPerformanceChart, PortfolioPerformanceChart, PortfolioValueChart } from './Charts';
import { ProBlur } from './ProBlur';
import { UsageMeter } from './UsageMeter';
import { ErrorBoundary } from './ErrorBoundary';
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
  usePositionsWithCalculatedValues
} from '@/lib/hooks';
import { accountSupportsPositions, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Transaction } from '@/lib/types';

type TabType = 'dashboard' | 'accounts' | 'positions' | 'transactions' | 'dividends';

const TAB_IDS: readonly TabType[] = ['dashboard', 'accounts', 'positions', 'transactions', 'dividends'];

function parseTab(value: string | null): TabType {
  return TAB_IDS.includes(value as TabType) ? (value as TabType) : 'dashboard';
}

export function Dashboard() {
  // L'onglet actif vit dans l'URL (?tab=...) : il survit au rechargement,
  // se partage et suit le bouton retour du navigateur.
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get('tab'));
  const setActiveTab = useCallback((tab: TabType) => {
    const params = new URLSearchParams(window.location.search);
    if (tab === 'dashboard') params.delete('tab');
    else params.set('tab', tab);
    const query = params.toString();
    window.history.pushState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    window.scrollTo({ top: 0 });
  }, []);
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

  const { user, signOut } = useAuth();
  const router = useRouter();
  const { isFree, hasFeature, limits } = useSubscription();
  const canImportTransactions = hasFeature('import_transactions');

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
  const { quotes, refetch: refetchQuotes } = useStockQuotes(symbols);

  // Historique du portefeuille (calculé dynamiquement)
  const { history: portfolioHistory, fxRates: dashboardFxRates, loading: loadingHistory } = usePortfolioHistory(
    transactions,
    accounts,
    historyPeriod,
    { enabled: activeTab === 'dashboard', quotes }
  );

  // Comptes et résumé calculés avec les mêmes taux FX que l'historique dashboard.
  const enrichedAccounts = useAccountsWithCalculatedValues(accounts, transactions, enrichedPositions, quotes, dashboardFxRates);
  const { stats: accountsYearToDateStats, total: portfolioYearToDateStats } = useAccountsYearToDateStats(
    enrichedAccounts,
    transactions,
    { enabled: activeTab === 'dashboard' || activeTab === 'accounts' }
  );
  const portfolioSummary = usePortfolioSummary(enrichedPositions, quotes, dashboardFxRates);
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
  const scopedPortfolioSummary = usePortfolioSummary(positionsScoped.positions, quotes, positionsFxRates);
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

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
    router.refresh();
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
  // Premier chargement uniquement : les rafraîchissements gardent les données affichées.
  const isInitialLoading = isLoading && accounts.length === 0;
  const isEmpty = !isLoading && accounts.length === 0;

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: BarChart2 },
    { id: 'accounts' as TabType, label: 'Comptes', icon: Wallet },
    { id: 'positions' as TabType, label: 'Positions', icon: TrendingUp },
    { id: 'transactions' as TabType, label: 'Transactions', icon: History },
    { id: 'dividends' as TabType, label: 'Dividendes', icon: Coins },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[color:var(--paper)]/85 border-b border-[color:var(--rule)]">
        <div className="max-w-7xl mx-auto px-5">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4 min-w-0">
              <Link
                href="/dashboard"
                className="flex items-baseline gap-2 text-[color:var(--ink)] hover:opacity-80 transition-opacity"
              >
                <span className="display text-2xl leading-none">Fi&#8209;Hub</span>
              </Link>
              <p
                className="hidden sm:block mono text-[10px] tracking-[0.12em] uppercase text-[color:var(--ink-soft)] truncate"
                suppressHydrationWarning
              >
                Mis à jour : {formatDateTime(lastUpdate)}
              </p>
            </div>

            <div className="flex items-center gap-1 sm:gap-3">
              <span className="hidden md:inline truncate max-w-[180px] mono text-[11px] tracking-[0.08em] text-[color:var(--ink-soft)]">
                {user?.email}
              </span>
              {isFree && (
                <Link
                  href="/settings/billing"
                  className="btn-ink inline-flex shrink-0 items-center justify-center rounded-full px-3 py-2 text-xs font-medium sm:px-4 sm:text-sm"
                  title="Passer pro"
                  aria-label="Passer pro"
                >
                  <span className="sm:hidden">Pro</span>
                  <span className="hidden sm:inline">Passer pro</span>
                </Link>
              )}
              <button
                onClick={handleRefresh}
                disabled={isLoading || refreshing}
                className="p-1.5 sm:p-2 rounded-lg text-[color:var(--ink-soft)] hover:bg-[color:var(--paper-2)] hover:text-[color:var(--ink)] transition-colors disabled:opacity-50"
                title="Rafraîchir les données et les cours"
                aria-label="Rafraîchir les données et les cours"
              >
                <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 ${isLoading || refreshing ? 'animate-spin' : ''}`} />
              </button>
              <Link
                href="/settings/profile"
                className="p-1.5 sm:p-2 rounded-lg text-[color:var(--ink-soft)] hover:bg-[color:var(--paper-2)] hover:text-[color:var(--ink)] transition-colors"
                title="Paramètres"
                aria-label="Paramètres"
              >
                <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
              <button
                onClick={handleLogout}
                className="p-1.5 sm:p-2 rounded-lg text-[color:var(--ink-soft)] hover:bg-[color:var(--paper-2)] hover:text-[color:var(--ink)] transition-colors"
                title="Déconnexion"
                aria-label="Déconnexion"
              >
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>

          {/* Tabs - five equal columns (icon above label) on mobile, inline row from sm */}
          <nav className="-mx-5 grid grid-cols-5 -mb-px border-t border-[color:var(--rule)]/70 sm:mx-0 sm:flex sm:gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-2 text-[11px] font-medium leading-tight border-b-2 transition-colors whitespace-nowrap sm:min-h-0 sm:flex-row sm:gap-2 sm:px-4 sm:py-3 sm:font-mono sm:font-normal sm:tracking-[0.12em] sm:uppercase ${
                  activeTab === tab.id
                    ? 'border-[color:var(--accent)] text-[color:var(--ink)]'
                    : 'border-transparent text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]'
                }`}
              >
                <tab.icon className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {activeTab === 'dashboard' && isEmpty && (
          <GettingStarted
            canImport={canImportTransactions}
            onAddAccount={() => setShowAddAccount(true)}
          />
        )}

        {activeTab === 'dashboard' && !isEmpty && (
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            {isFree && (
              <div className="grid gap-2 sm:grid-cols-3">
                <UsageMeter label="Comptes" current={accounts.length} max={limits.maxAccounts} />
                <UsageMeter label="Transactions" current={transactions.length} max={limits.maxTransactions} />
                <UsageMeter label="Positions" current={enrichedPositions.length} max={limits.maxPositions} />
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
                loading={isInitialLoading}
              />
            </ErrorBoundary>

            {/* Charts - stack on mobile */}
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
              <ErrorBoundary label="Répartition">
                <ProBlur feature="advanced_analytics" label="Répartition détaillée — Pro">
                  <AllocationChart positions={enrichedPositions} quotes={quotes} fxRates={dashboardFxRates} />
                </ProBlur>
              </ErrorBoundary>
              <ErrorBoundary label="Allocation par compte">
                <AccountAllocationChart accounts={enrichedAccounts} />
              </ErrorBoundary>
            </div>

            {/* History Chart */}
            <ErrorBoundary label="Évolution du portefeuille">
              <ProBlur feature="advanced_analytics" label="Évolution du portefeuille — Pro">
                <PortfolioHistoryChart
                  history={portfolioHistory}
                  loading={loadingHistory}
                  onPeriodChange={setHistoryPeriod}
                  selectedPeriod={historyPeriod}
                />
              </ProBlur>
            </ErrorBoundary>

            {/* Quick Views - stack on mobile */}
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 w-full max-w-full">
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
                    {transactions.length > 5 && (
                      <button
                        onClick={() => setActiveTab('transactions')}
                        className="inline-flex items-center gap-1 text-xs sm:text-sm text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] hover:underline underline-offset-4"
                      >
                        <span>Tout voir</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Mes comptes
              </h2>
              <button
                onClick={() => setShowAddAccount(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 btn-ink rounded-lg text-sm sm:text-base"
              >
                <Plus className="h-4 w-4" />
                <span>Ajouter un compte</span>
              </button>
            </div>
            <AccountList
              accounts={enrichedAccounts}
              yearToDateStats={accountsYearToDateStats}
              positionActivityAccountIds={positionActivityAccountIds}
              onChanged={handleMutationSuccess}
            />
          </div>
        )}

        {activeTab === 'positions' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  Mes positions
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Ajoutez une position via une transaction d&apos;achat
                </p>
              </div>
              <button
                onClick={() => openAddTransaction({
                  accountId: selectedPositionsAccountFilter ?? undefined,
                  type: 'BUY',
                })}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 btn-ink rounded-lg text-sm sm:text-base"
              >
                <Plus className="h-4 w-4" />
                <span>Ajouter une position</span>
              </button>
            </div>

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
            </ErrorBoundary>

            <ErrorBoundary label="Valeur vs investissement">
              <PortfolioValueChart
                history={positionsFullPortfolioHistory}
                transactions={positionsScoped.transactions}
                loading={loadingPositionsFullHistory}
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
                  loading={loadingPositionsFullHistory}
                  currentPortfolioValue={scopedStockPortfolioValue}
                  fxRates={positionsFxRates}
                />
              </ProBlur>
            </ErrorBoundary>

            <ErrorBoundary label="Comparaison benchmark">
              <ProBlur feature="advanced_analytics" partial label="Comparaison benchmark — Pro">
                <BenchmarkComparisonChart
                  portfolioHistory={positionsFullPortfolioHistory}
                  transactions={positionsScoped.transactions}
                  loading={loadingPositionsFullHistory}
                  currentPortfolioValue={scopedStockPortfolioValue}
                  fxRates={positionsFxRates}
                />
              </ProBlur>
            </ErrorBoundary>

            <ErrorBoundary label="Projection du patrimoine">
              <PerformanceProjectionChart
                history={positionsFullPortfolioHistory}
                transactions={positionsScoped.transactions}
                loading={loadingPositionsFullHistory}
                fxRates={positionsFxRates}
              />
            </ErrorBoundary>

            <ErrorBoundary label="Tableau des positions">
              <PositionsTable
                positions={positionsScoped.positions}
                quotes={quotes}
                accounts={positionsScoped.accounts}
                transactions={positionsScoped.transactions}
                groupByAccount={selectedPositionsAccountFilter === null && stockAccounts.length > 1}
                fxRates={positionsFxRates}
              />
            </ErrorBoundary>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Historique des Transactions
              </h2>
              <div className="flex flex-col sm:flex-row gap-2">
                {canImportTransactions ? (
                  <Link
                    href="/dashboard/import"
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm sm:text-base"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Importer</span>
                  </Link>
                ) : (
                  <Link
                    href="/settings/billing"
                    className="flex items-center justify-center gap-2 px-4 py-2 btn-outline rounded-lg text-sm sm:text-base"
                    title="Import réservé à l’offre Pro"
                  >
                    <Lock className="h-4 w-4" />
                    <span>Importer vos données</span>
                  </Link>
                )}
                <button
                  onClick={() => openAddTransaction()}
                  className="flex items-center justify-center gap-2 px-4 py-2 btn-ink rounded-lg text-sm sm:text-base"
                >
                  <Plus className="h-4 w-4" />
                  <span>Ajouter une transaction</span>
                </button>
              </div>
            </div>
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
            <div className="mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Mes dividendes
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Ajoutez vos dividendes via l&apos;onglet Transactions
              </p>
            </div>
            <DividendsTable 
              transactions={transactions}
              positions={enrichedPositions}
              quotes={quotes}
            />
          </div>
        )}
      </main>

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
    </div>
  );
}

function GettingStarted({
  canImport,
  onAddAccount,
}: {
  canImport: boolean;
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
          </Link>
        ) : (
          <Link
            href="/settings/billing"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 btn-outline rounded-lg text-sm sm:text-base"
            title="Import réservé à l’offre Pro"
          >
            <Lock className="h-4 w-4" />
            <span>Importer un relevé (Pro)</span>
          </Link>
        )}
      </div>
    </section>
  );
}
