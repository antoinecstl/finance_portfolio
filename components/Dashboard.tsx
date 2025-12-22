'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  RefreshCw, 
  Plus, 
  Wallet, 
  BarChart2, 
  History, 
  TrendingUp,
  LogOut,
  Loader2,
  Coins
} from 'lucide-react';
import { PortfolioStats } from './PortfolioStats';
import { AccountList } from './AccountList';
import { PositionsTable } from './PositionsTable';
import { TransactionsList } from './TransactionsList';
import { DividendsTable } from './DividendsTable';
import { AllocationChart, SectorAllocationChart, PortfolioHistoryChart } from './Charts';
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
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [historyPeriod, setHistoryPeriod] = useState(30);

  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const { accounts, loading: loadingAccounts, refetch: refetchAccounts } = useAccounts();
  const { positions, loading: loadingPositions, refetch: refetchPositions } = usePositions();
  const { transactions, loading: loadingTransactions, refetch: refetchTransactions } = useTransactions();

  // Extraire les symboles pour les cotations
  const symbols = useMemo(() => positions.map(p => p.symbol), [positions]);
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

  // Calculer le total épargne (comptes non-actions)
  const savingsTotal = useMemo(() => {
    return enrichedAccounts
      .filter(a => !['PEA', 'CTO'].includes(a.type))
      .reduce((sum, a) => sum + a.balance, 0);
  }, [enrichedAccounts]);

  // Rediriger vers login si non connecté
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleRefresh = async () => {
    await Promise.all([
      refetchAccounts(),
      refetchPositions(),
      refetchTransactions(),
      refetchQuotes(),
    ]);
    setLastUpdate(new Date());
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const handleAccountSuccess = () => {
    refetchAccounts();
  };

  const handleTransactionSuccess = () => {
    refetchTransactions();
    refetchAccounts();
    refetchPositions(); // Mettre à jour les positions aussi
  };

  const handlePositionSuccess = () => {
    refetchPositions();
  };

  // Afficher loader pendant le chargement auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Ne rien afficher si pas connecté (redirection en cours)
  if (!user) {
    return null;
  }

  const isLoading = loadingAccounts || loadingPositions || loadingTransactions;

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: BarChart2 },
    { id: 'accounts' as TabType, label: 'Comptes', icon: Wallet },
    { id: 'positions' as TabType, label: 'Positions', icon: TrendingUp },
    { id: 'transactions' as TabType, label: 'Transactions', icon: History },
    { id: 'dividends' as TabType, label: 'Dividendes', icon: Coins },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 rounded-lg p-2">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Mon Portefeuille
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Mis à jour: {formatDateTime(lastUpdate)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                {user.email}
              </span>
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                title="Rafraîchir"
              >
                <RefreshCw className={`h-5 w-5 text-zinc-600 dark:text-zinc-400 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400"
                title="Déconnexion"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Stats */}
            <PortfolioStats
              totalValue={portfolioSummary.totalValue}
              totalInvested={portfolioSummary.totalInvested}
              totalGain={portfolioSummary.totalGain}
              totalGainPercent={portfolioSummary.totalGainPercent}
              dayChange={portfolioSummary.dayChange}
              dayChangePercent={portfolioSummary.dayChangePercent}
              savingsTotal={savingsTotal}
            />

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              <AllocationChart positions={enrichedPositions} quotes={quotes} />
              <SectorAllocationChart positions={enrichedPositions} quotes={quotes} />
            </div>

            {/* History Chart */}
            <PortfolioHistoryChart 
              history={portfolioHistory}
              loading={loadingHistory}
              onPeriodChange={setHistoryPeriod}
              selectedPeriod={historyPeriod}
            />

            {/* Quick Views */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Mes Comptes
                  </h2>
                  <button
                    onClick={() => setShowAddAccount(true)}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </button>
                </div>
                <AccountList accounts={enrichedAccounts} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Dernières Transactions
                  </h2>
                  <button
                    onClick={() => setShowAddTransaction(true)}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </button>
                </div>
                <TransactionsList transactions={transactions} limit={5} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Mes Comptes
              </h2>
              <button
                onClick={() => setShowAddAccount(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Ajouter un compte
              </button>
            </div>
            <AccountList accounts={enrichedAccounts} />
          </div>
        )}

        {activeTab === 'positions' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Mes Positions
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Gérez vos positions via l'onglet Transactions
              </p>
            </div>
            <PositionsTable 
              positions={enrichedPositions} 
              quotes={quotes} 
              accounts={enrichedAccounts}
              transactions={transactions}
            />
          </div>
        )}

        {activeTab === 'transactions' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Historique des Transactions
              </h2>
              <button
                onClick={() => setShowAddTransaction(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Ajouter une transaction
              </button>
            </div>
            <TransactionsList 
              transactions={transactions} 
              accounts={accounts}
              showFilters={true}
            />
          </div>
        )}

        {activeTab === 'dividends' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Mes Dividendes
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Ajoutez vos dividendes via l'onglet Transactions
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
        onSuccess={handleAccountSuccess}
      />
      
      <AddTransactionModal
        isOpen={showAddTransaction}
        onClose={() => setShowAddTransaction(false)}
        onSuccess={handleTransactionSuccess}
        accounts={accounts}
      />

      <AddPositionModal
        isOpen={showAddPosition}
        onClose={() => setShowAddPosition(false)}
        onSuccess={handlePositionSuccess}
        accounts={accounts}
      />
    </div>
  );
}
