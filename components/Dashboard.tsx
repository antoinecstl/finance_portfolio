'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  RefreshCw, 
  Plus, 
  Wallet, 
  BarChart2, 
  History, 
  TrendingUp,
  LogOut,
  Settings,
  Coins
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
import { useSubscription } from '@/lib/subscription-client';
import { AddAccountModal } from './AddAccountModal';
import { AddTransactionModal } from './AddTransactionModal';
import { AddPositionModal } from './AddPositionModal';
import { 
  useAccounts, 
  usePositions, 
  useTransactions, 
  useStockQuotes,
  usePortfolioSummary,
  usePortfolioHistory,
  useFullPortfolioHistory,
  useAccountsWithCalculatedValues,
  usePositionsWithCalculatedValues
} from '@/lib/hooks';
import { formatDateTime } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

type TabType = 'dashboard' | 'accounts' | 'positions' | 'transactions' | 'dividends';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showAddPosition, setShowAddPosition] = useState(false);
  // Initialisé null pour éviter un mismatch d'hydration : `new Date()` côté
  // serveur ≠ côté client (horloge + fuseau). Renseigné après mount.
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  useEffect(() => {
    setLastUpdate(new Date());
  }, []);
  const [historyPeriod, setHistoryPeriod] = useState(30);
  const [txVersion, setTxVersion] = useState(0);

  const { user, signOut } = useAuth();
  const router = useRouter();
  const { isFree, limits } = useSubscription();

  const { accounts, loading: loadingAccounts, refetch: refetchAccounts } = useAccounts();
  const { positions, loading: loadingPositions, refetch: refetchPositions } = usePositions();
  const { transactions, loading: loadingTransactions, refetch: refetchTransactions } = useTransactions();

  // Extraire les symboles pour les cotations (positions + transactions)
  const symbols = useMemo(() => {
    const symbolSet = new Set<string>();

    positions.forEach((position) => {
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
  }, [positions, transactions]);
  const { quotes, refetch: refetchQuotes } = useStockQuotes(symbols);

  // Positions enrichies avec quantités calculées depuis les transactions
  const enrichedPositions = usePositionsWithCalculatedValues(positions, transactions);

  // Comptes enrichis avec valeurs calculées (PEA/CTO recalculés dynamiquement)
  const enrichedAccounts = useAccountsWithCalculatedValues(accounts, transactions, enrichedPositions, quotes);

  // Calculer le résumé du portefeuille (utiliser les positions enrichies)
  const portfolioSummary = usePortfolioSummary(enrichedPositions, quotes);

  // Historique du portefeuille (calculé dynamiquement)
  const { history: portfolioHistory, loading: loadingHistory } = usePortfolioHistory(
    transactions,
    accounts,
    historyPeriod
  );

  // Historique complet pour la performance annuelle (depuis la première transaction)
  const { history: fullPortfolioHistory, loading: loadingFullHistory } = useFullPortfolioHistory(
    transactions,
    accounts
  );

  // Calculer le total épargne (comptes non-actions)
  const savingsTotal = useMemo(() => {
    return enrichedAccounts
      .filter(a => !['PEA', 'CTO'].includes(a.type))
      .reduce((sum, a) => sum + a.calculatedTotalValue, 0);
  }, [enrichedAccounts]);

  // Cash disponible sur les comptes actions (PEA/CTO)
  const stockCashTotal = useMemo(() => {
    return enrichedAccounts
      .filter(a => ['PEA', 'CTO'].includes(a.type))
      .reduce((sum, a) => sum + (a.calculatedCash ?? 0), 0);
  }, [enrichedAccounts]);

  // Valeur globale du portefeuille = somme de tous les comptes (source de vérité unifiée)
  const totalPortfolioValue = useMemo(() => {
    return enrichedAccounts.reduce((sum, account) => sum + account.calculatedTotalValue, 0);
  }, [enrichedAccounts]);

  // Valeur de l'univers actions = positions + cash PEA/CTO
  const stockPortfolioValue = useMemo(() => {
    return portfolioSummary.totalValue + stockCashTotal;
  }, [portfolioSummary.totalValue, stockCashTotal]);

  const refreshAllData = useCallback(async () => {
    const [nextAccounts, nextPositions, nextTransactions] = await Promise.all([
      refetchAccounts(),
      refetchPositions(),
      refetchTransactions(),
    ]);

    // Force les quotes à utiliser les symboles fraîchement récupérés.
    const nextSymbols = [...new Set([
      ...nextPositions.map((position) => position.symbol.toUpperCase()),
      ...nextTransactions
        .map((transaction) => transaction.stock_symbol?.toUpperCase())
        .filter((symbol): symbol is string => Boolean(symbol)),
    ])];
    await refetchQuotes(nextSymbols);

    setLastUpdate(new Date());
    return { nextAccounts, nextPositions, nextTransactions };
  }, [refetchAccounts, refetchPositions, refetchTransactions, refetchQuotes]);

  const handleRefresh = async () => {
    await refreshAllData();
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
    router.refresh();
  };

  // Unique point d'entrée post-mutation : refetch tout + bump txVersion pour
  // que la liste paginée (cursor-based, state local) reparte du curseur initial.
  const handleMutationSuccess = useCallback(async () => {
    setTxVersion(v => v + 1);
    await refreshAllData();
  }, [refreshAllData]);

  const isLoading = loadingAccounts || loadingPositions || loadingTransactions;

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
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-blue-600 rounded-lg p-1.5 sm:p-2">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="hidden xs:block">
                <h1 className="text-base sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Mon Portefeuille
                </h1>
                <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
                  Mis à jour: {lastUpdate ? formatDateTime(lastUpdate) : '—'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-3">
              <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 hidden md:inline truncate max-w-[150px]">
                {user?.email}
              </span>
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                title="Rafraîchir"
              >
                <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 text-zinc-600 dark:text-zinc-400 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <Link
                href="/settings/profile"
                className="p-1.5 sm:p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400"
                title="Paramètres"
              >
                <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
              <button
                onClick={handleLogout}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400"
                title="Déconnexion"
              >
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>

          {/* Tabs - scrollable on mobile */}
          <nav className="flex gap-1 -mb-px overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.slice(0, 4)}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            {isFree && (
              <div className="grid gap-2 sm:grid-cols-3">
                <UsageMeter label="Comptes" current={accounts.length} max={limits.maxAccounts} />
                <UsageMeter label="Transactions" current={transactions.length} max={limits.maxTransactions} />
                <UsageMeter label="Positions" current={positions.length} max={limits.maxPositions} />
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
              />
            </ErrorBoundary>

            {/* Charts - stack on mobile */}
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
              <ErrorBoundary label="Répartition">
                <ProBlur feature="advanced_analytics" label="Répartition détaillée — Pro">
                  <AllocationChart positions={enrichedPositions} quotes={quotes} />
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
                    Mes Comptes
                  </h2>
                  <button
                    onClick={() => setShowAddAccount(true)}
                    className="shrink-0 inline-flex items-center gap-1 text-xs sm:text-sm text-blue-600 hover:text-blue-700"
                    title="Ajouter un compte"
                  >
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Ajouter</span>
                  </button>
                </div>
                <div className="w-full max-w-full overflow-hidden">
                  <ErrorBoundary label="Comptes">
                    <AccountList accounts={enrichedAccounts} onDeleted={handleMutationSuccess} />
                  </ErrorBoundary>
                </div>
              </div>

              <div className="min-w-0 w-full max-w-full">
                <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 min-w-0">
                  <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    Dernières Transactions
                  </h2>
                  <button
                    onClick={() => setShowAddTransaction(true)}
                    className="shrink-0 inline-flex items-center gap-1 text-xs sm:text-sm text-blue-600 hover:text-blue-700"
                    title="Ajouter une transaction"
                  >
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Ajouter</span>
                  </button>
                </div>
                <div className="w-full max-w-full overflow-hidden">
                  <ErrorBoundary label="Dernières transactions">
                    <TransactionsList transactions={transactions} limit={5} onDeleted={handleMutationSuccess} />
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
                Mes Comptes
              </h2>
              <button
                onClick={() => setShowAddAccount(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
              >
                <Plus className="h-4 w-4" />
                <span>Ajouter un compte</span>
              </button>
            </div>
            <AccountList accounts={enrichedAccounts} onDeleted={handleMutationSuccess} />
          </div>
        )}

        {activeTab === 'positions' && (
          <div className="space-y-4 sm:space-y-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Mes Positions
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Gérez vos positions via l&apos;onglet Transactions
              </p>
            </div>

            <ErrorBoundary label="Performance par position">
              <PositionPerformanceChart
                positions={enrichedPositions}
                quotes={quotes}
                transactions={transactions}
                portfolioTotalValue={stockPortfolioValue}
                portfolioTotalInvested={portfolioSummary.totalInvested}
                portfolioTotalGain={portfolioSummary.totalGain}
                portfolioTotalGainPercent={portfolioSummary.totalGainPercent}
                portfolioDayChange={portfolioSummary.dayChange}
              />
            </ErrorBoundary>

            <ErrorBoundary label="Valeur vs Investissement">
              <PortfolioValueChart
                history={fullPortfolioHistory}
                transactions={transactions}
                loading={loadingFullHistory}
                currentTotalValue={portfolioSummary.totalValue}
                currentTotalInvested={portfolioSummary.totalInvested}
              />
            </ErrorBoundary>

            <ErrorBoundary label="Performance annuelle">
              <ProBlur feature="advanced_analytics" partial label="Performance annuelle — Pro">
                <PortfolioPerformanceChart
                  transactions={transactions}
                  portfolioHistory={fullPortfolioHistory}
                  accounts={enrichedAccounts}
                  loading={loadingFullHistory}
                  currentPortfolioValue={stockPortfolioValue}
                />
              </ProBlur>
            </ErrorBoundary>

            <ErrorBoundary label="Comparaison benchmark">
              <ProBlur feature="advanced_analytics" partial label="Comparaison benchmark — Pro">
                <BenchmarkComparisonChart
                  portfolioHistory={fullPortfolioHistory}
                  transactions={transactions}
                  loading={loadingFullHistory}
                />
              </ProBlur>
            </ErrorBoundary>

            <ErrorBoundary label="Tableau des positions">
              <PositionsTable
                positions={enrichedPositions}
                quotes={quotes}
                accounts={enrichedAccounts}
                transactions={transactions}
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
              <button
                onClick={() => setShowAddTransaction(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
              >
                <Plus className="h-4 w-4" />
                <span>Ajouter une transaction</span>
              </button>
            </div>
            <PaginatedTransactionsList
              accounts={accounts}
              pageSize={50}
              version={txVersion}
              onDeleted={handleMutationSuccess}
            />
          </div>
        )}

        {activeTab === 'dividends' && (
          <div>
            <div className="mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Mes Dividendes
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
        positions={positions}
        transactions={transactions}
      />

      <AddPositionModal
        isOpen={showAddPosition}
        onClose={() => setShowAddPosition(false)}
        onSuccess={handleMutationSuccess}
        accounts={accounts}
      />
    </div>
  );
}
