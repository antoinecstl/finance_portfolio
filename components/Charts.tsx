'use client';

import React, { useMemo, useState } from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
  BarChart,
  Bar,
  ReferenceLine,
  ComposedChart
} from 'recharts';
import { StockPosition, StockQuote, Transaction, Account } from '@/lib/types';
import { PortfolioHistoryPoint, calculatePortfolioPerformance, PortfolioPerformanceData } from '@/lib/portfolio-calculator';
import { formatCurrency, formatPercent, CHART_COLORS, getSectorColor } from '@/lib/utils';
import { PieChart as PieChartIcon, TrendingUp, TrendingDown, Loader2, BarChart2, Target, Scale, Activity, ChevronDown, ChevronRight, ShoppingCart, DollarSign, Banknote, CircleDollarSign, Percent, Wallet, ArrowUpRight, ArrowDownRight, PiggyBank, LineChart as LineChartIcon } from 'lucide-react';

interface AllocationChartProps {
  positions: StockPosition[];
  quotes: Record<string, StockQuote>;
}

export function AllocationChart({ positions, quotes }: AllocationChartProps) {
  // Calculer la répartition par action
  const data = positions.map((position, index) => {
    const currentPrice = quotes[position.symbol]?.price || position.current_price;
    const value = position.quantity * currentPrice;
    return {
      name: position.symbol,
      fullName: position.name,
      value,
      color: getSectorColor(index),
    };
  }).sort((a, b) => b.value - a.value);

  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <PieChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Répartition du Portefeuille
          </h3>
        </div>
        <div className="text-center py-8 sm:py-12">
          <PieChartIcon className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
          <p className="mt-3 sm:mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Ajoutez des positions pour voir la répartition
          </p>
        </div>
      </div>
    );
  }

  // Préparer les données pour le BarChart horizontal
  const barData = data.map(item => ({
    ...item,
    percentage: (item.value / totalValue) * 100,
  }));

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <PieChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
        <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
          Répartition du Portefeuille
        </h3>
      </div>
      <div className="space-y-2">
        {barData.map((item, index) => (
          <div key={item.name} className="space-y-1">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[120px]" title={item.fullName}>
                {item.name}
              </span>
              <span className="text-zinc-600 dark:text-zinc-400">
                {formatCurrency(item.value)} ({item.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${item.percentage}%`,
                  backgroundColor: item.color 
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex justify-between text-sm font-medium">
          <span className="text-zinc-900 dark:text-zinc-100">Total</span>
          <span className="text-zinc-900 dark:text-zinc-100">{formatCurrency(totalValue)}</span>
        </div>
      </div>
    </div>
  );
}

interface SectorAllocationChartProps {
  positions: StockPosition[];
  quotes: Record<string, StockQuote>;
}

export function SectorAllocationChart({ positions, quotes }: SectorAllocationChartProps) {
  // Gardé pour compatibilité mais non utilisé
  return null;
}

// Nouveau composant pour la répartition par compte

interface AccountAllocationChartProps {
  accounts: Array<Account & { calculatedTotalValue?: number }>;
}

export function AccountAllocationChart({ accounts }: AccountAllocationChartProps) {
  // Calculer la répartition par compte
  const data = accounts
    .map((account, index) => {
      const value = account.calculatedTotalValue ?? account.balance;
      return {
        name: account.name,
        type: account.type,
        value,
        color: getSectorColor(index),
      };
    })
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Répartition par Compte
          </h3>
        </div>
        <div className="text-center py-8 sm:py-12">
          <Wallet className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
          <p className="mt-3 sm:mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Ajoutez des comptes pour voir la répartition
          </p>
        </div>
      </div>
    );
  }

  // Préparer les données avec pourcentages
  const barData = data.map(item => ({
    ...item,
    percentage: (item.value / totalValue) * 100,
  }));

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'PEA': 'PEA',
      'CTO': 'CTO',
      'LIVRET_A': 'Livret A',
      'LDDS': 'LDDS',
      'ASSURANCE_VIE': 'Ass. Vie',
      'PEL': 'PEL',
      'AUTRE': 'Autre',
    };
    return labels[type] || type;
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
        <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
          Répartition par Compte
        </h3>
      </div>
      <div className="space-y-2">
        {barData.map((item, index) => (
          <div key={item.name} className="space-y-1">
            <div className="flex justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate" title={item.name}>
                  {item.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500 flex-shrink-0">
                  {getTypeLabel(item.type)}
                </span>
              </div>
              <span className="text-zinc-600 dark:text-zinc-400 flex-shrink-0 ml-2">
                {formatCurrency(item.value)} ({item.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${item.percentage}%`,
                  backgroundColor: item.color 
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex justify-between text-sm font-medium">
          <span className="text-zinc-900 dark:text-zinc-100">Total</span>
          <span className="text-zinc-900 dark:text-zinc-100">{formatCurrency(totalValue)}</span>
        </div>
      </div>
    </div>
  );
}

interface PortfolioHistoryChartProps {
  history: PortfolioHistoryPoint[];
  loading?: boolean;
  onPeriodChange?: (days: number) => void;
  selectedPeriod?: number;
}

export function PortfolioHistoryChart({ 
  history, 
  loading = false,
  onPeriodChange,
  selectedPeriod = 30
}: PortfolioHistoryChartProps) {
  const periods = [
    { label: '1M', days: 30 },
    { label: '3M', days: 90 },
    { label: '6M', days: 180 },
    { label: '1A', days: 365 },
    { label: 'Max', days: 3650 },
  ];

  const data = history.map((item) => ({
    date: new Date(item.date).toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: 'short',
      year: '2-digit'
    }),
    fullDate: new Date(item.date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }),
    totalValue: item.totalValue,
    stocksValue: item.stocksValue,
    savingsValue: item.savingsValue,
  }));

  // Calculer la performance sur la période
  const firstValue = data.length > 0 ? data[0].totalValue : 0;
  const lastValue = data.length > 0 ? data[data.length - 1].totalValue : 0;
  const periodChange = lastValue - firstValue;
  const periodChangePercent = firstValue > 0 ? (periodChange / firstValue) * 100 : 0;

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Évolution du Portefeuille
          </h3>
        </div>
        <div className="flex items-center justify-center py-8 sm:py-12">
          <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 animate-spin" />
          <span className="ml-2 text-sm text-zinc-500">Chargement...</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Évolution du Portefeuille
          </h3>
        </div>
        <div className="text-center py-8 sm:py-12">
          <TrendingUp className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
          <p className="mt-3 sm:mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Ajoutez des transactions pour voir l&apos;évolution
          </p>
        </div>
      </div>
    );
  }

  const minValue = Math.min(...data.map(d => d.totalValue)) * 0.95;
  const maxValue = Math.max(...data.map(d => d.totalValue)) * 1.05;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Évolution du Portefeuille
          </h3>
        </div>
        
        {/* Sélecteur de période */}
        {onPeriodChange && (
          <div className="flex gap-1">
            {periods.map((period) => (
              <button
                key={period.days}
                onClick={() => onPeriodChange(period.days)}
                className={`px-2 py-1 text-[10px] sm:text-xs rounded transition-colors ${
                  selectedPeriod === period.days
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Variation de valeur de la période (⚠️ inclut les apports/retraits) */}
      <div className="flex flex-wrap gap-2 sm:gap-4 mb-3 sm:mb-4 text-xs sm:text-sm">
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Début: </span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {formatCurrency(firstValue)}
          </span>
        </div>
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Fin: </span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {formatCurrency(lastValue)}
          </span>
        </div>
        <div>
          <span className="text-zinc-500 dark:text-zinc-400 hidden sm:inline">Δ Valeur: </span>
          <span className={`font-medium ${periodChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {periodChange >= 0 ? '+' : ''}{formatCurrency(periodChange)} ({formatPercent(periodChangePercent)})
          </span>
          <span className="text-zinc-400 text-[10px] ml-1" title="Cette variation inclut les apports et retraits, ce n'est pas un rendement">ⓘ</span>
        </div>
      </div>

      <div className="h-[220px] sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorStocks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10 }}
              stroke="#9ca3af"
              interval="preserveStartEnd"
            />
            <YAxis 
              domain={[minValue, maxValue]}
              tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k€` : `${value.toFixed(0)}€`}
              tick={{ fontSize: 10 }}
              stroke="#9ca3af"
              width={45}
            />
            <Tooltip 
              formatter={(value, name) => {
                const label = name === 'totalValue' ? 'Total' : 
                             name === 'stocksValue' ? 'PEA/CTO' : 'Épargne';
                return [formatCurrency(Number(value) || 0), label];
              }}
              labelFormatter={(_, payload) => {
                if (payload && payload.length > 0) {
                  return payload[0].payload.fullDate;
                }
                return '';
              }}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                color: '#18181b',
              }}
              labelStyle={{
                color: '#18181b',
                fontWeight: 600,
                marginBottom: '4px',
              }}
            />
            <Area 
              type="monotone" 
              dataKey="totalValue" 
              stroke="#3B82F6" 
              strokeWidth={2}
              fill="url(#colorTotal)"
              name="totalValue"
            />
            <Area 
              type="monotone" 
              dataKey="stocksValue" 
              stroke="#10B981" 
              strokeWidth={1}
              fill="url(#colorStocks)"
              name="stocksValue"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Légende */}
      <div className="flex gap-4 mt-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500"></div>
          <span className="text-zinc-600 dark:text-zinc-400">Total</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-500"></div>
          <span className="text-zinc-600 dark:text-zinc-400">PEA/CTO</span>
        </div>
      </div>
    </div>
  );
}
// ===== POSITION PERFORMANCE CHART =====
// Graphique complet avec infos détaillées sur chaque position

interface PositionPerformanceChartProps {
  positions: StockPosition[];
  quotes: Record<string, StockQuote>;
  transactions?: Transaction[];
}

interface PositionMetrics {
  symbol: string;
  name: string;
  currentValue: number;
  investedValue: number;
  gainValue: number;
  gainPercent: number;
  dayChange: number;
  dayChangePercent: number;
  weight: number;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  color: string;
}

export function PositionPerformanceChart({ positions, quotes, transactions = [] }: PositionPerformanceChartProps) {
  // État pour les lignes étendues
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  // Filtrer les transactions par symbole
  const getTransactionsForSymbol = (symbol: string) => {
    return transactions
      .filter(t => t.stock_symbol === symbol)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Calculer les statistiques de transactions pour un symbole
  const getTransactionStats = (symbol: string) => {
    const symbolTransactions = getTransactionsForSymbol(symbol);
    
    const buys = symbolTransactions.filter(t => t.type === 'BUY');
    const sells = symbolTransactions.filter(t => t.type === 'SELL');
    const dividends = symbolTransactions.filter(t => t.type === 'DIVIDEND');
    
    const totalBought = buys.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const totalSold = sells.reduce((sum, t) => sum + (t.quantity || 0), 0);
    const totalBuyAmount = buys.reduce((sum, t) => sum + t.amount, 0);
    const totalSellAmount = sells.reduce((sum, t) => sum + t.amount, 0);
    const totalDividends = dividends.reduce((sum, t) => sum + t.amount, 0);
    
    return {
      buys,
      sells,
      dividends,
      totalBought,
      totalSold,
      totalBuyAmount,
      totalSellAmount,
      totalDividends,
      allTransactions: symbolTransactions
    };
  };

  // Calculer les métriques pour chaque position
  const metrics: PositionMetrics[] = positions.map((position, index) => {
    const quote = quotes[position.symbol];
    const currentPrice = quote?.price || position.current_price;
    const dayChange = quote?.change || 0;
    const dayChangePercent = quote?.changePercent || 0;
    
    const currentValue = position.quantity * currentPrice;
    const investedValue = position.quantity * position.average_price;
    const gainValue = currentValue - investedValue;
    const gainPercent = investedValue > 0 ? (gainValue / investedValue) * 100 : 0;
    
    return {
      symbol: position.symbol,
      name: position.name,
      currentValue,
      investedValue,
      gainValue,
      gainPercent,
      dayChange,
      dayChangePercent,
      weight: 0, // Calculé après
      quantity: position.quantity,
      avgPrice: position.average_price,
      currentPrice,
      color: getSectorColor(index),
    };
  });

  // Calculer le poids de chaque position
  const totalValue = metrics.reduce((sum, m) => sum + m.currentValue, 0);
  metrics.forEach(m => {
    m.weight = totalValue > 0 ? (m.currentValue / totalValue) * 100 : 0;
  });

  // Trier par valeur décroissante
  const sortedByValue = [...metrics].sort((a, b) => b.currentValue - a.currentValue);
  
  // Trier par performance
  const sortedByPerf = [...metrics].sort((a, b) => b.gainPercent - a.gainPercent);
  const bestPerformer = sortedByPerf[0];
  const worstPerformer = sortedByPerf[sortedByPerf.length - 1];

  // Calculer les totaux
  const totalInvested = metrics.reduce((sum, m) => sum + m.investedValue, 0);
  const totalGain = metrics.reduce((sum, m) => sum + m.gainValue, 0);
  const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const totalDayChange = metrics.reduce((sum, m) => sum + (m.dayChange * m.quantity), 0);

  // Données pour le graphique de performance par position
  const perfChartData = sortedByPerf.map(m => ({
    symbol: m.symbol,
    gainPercent: m.gainPercent,
    fill: m.gainPercent >= 0 ? '#10b981' : '#ef4444',
  }));

  // Données pour le graphique de répartition par poids
  const weightChartData = sortedByValue.map(m => ({
    symbol: m.symbol,
    weight: m.weight,
    value: m.currentValue,
    color: m.color,
  }));

  if (positions.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Performance des Positions
          </h3>
        </div>
        <div className="text-center py-8 sm:py-12">
          <Activity className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
          <p className="mt-3 sm:mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Ajoutez des positions pour voir les performances
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Résumé global */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Vue d'ensemble des Performances
          </h3>
        </div>
        
        {/* KPIs principaux */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Valorisation totale</p>
            <p className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(totalValue)}
            </p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Investi</p>
            <p className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(totalInvested)}
            </p>
          </div>
          <div className={`rounded-lg p-3 ${totalGain >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">+/- Value latente</p>
            <p className={`text-lg sm:text-xl font-bold ${totalGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {totalGain >= 0 ? '+' : ''}{formatCurrency(totalGain)}
            </p>
            <p className={`text-xs ${totalGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatPercent(totalGainPercent)}
            </p>
          </div>
          <div className={`rounded-lg p-3 ${totalDayChange >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Variation jour</p>
            <p className={`text-lg sm:text-xl font-bold ${totalDayChange >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              {totalDayChange >= 0 ? '+' : ''}{formatCurrency(totalDayChange)}
            </p>
          </div>
        </div>

        {/* Meilleure et pire performance */}
        {metrics.length >= 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-lg">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Meilleure perf.</p>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{bestPerformer.symbol}</p>
                <p className="text-sm font-bold text-emerald-600">
                  {bestPerformer.gainPercent >= 0 ? '+' : ''}{formatPercent(bestPerformer.gainPercent)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">PV</p>
                <p className="text-sm font-medium text-emerald-600">{formatCurrency(bestPerformer.gainValue)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="p-2 bg-red-100 dark:bg-red-800 rounded-lg">
                <TrendingDown className="h-4 w-4 text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Pire perf.</p>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{worstPerformer.symbol}</p>
                <p className="text-sm font-bold text-red-600">
                  {worstPerformer.gainPercent >= 0 ? '+' : ''}{formatPercent(worstPerformer.gainPercent)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">MV</p>
                <p className="text-sm font-medium text-red-600">{formatCurrency(worstPerformer.gainValue)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Graphiques côte à côte */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Graphique des performances */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
            <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
              Performance par Position
            </h3>
          </div>
          <div className="h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart 
                data={perfChartData} 
                layout="vertical"
                margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={true} vertical={false} />
                <XAxis 
                  type="number" 
                  domain={['dataMin - 5', 'dataMax + 5']}
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                  tick={{ fontSize: 10 }}
                  stroke="#9ca3af"
                />
                <YAxis 
                  type="category" 
                  dataKey="symbol" 
                  tick={{ fontSize: 11, fontWeight: 500 }}
                  stroke="#9ca3af"
                  width={50}
                />
                <ReferenceLine x={0} stroke="#6b7280" strokeWidth={1} />
                <Tooltip 
                  formatter={(value) => {
                    const numValue = Number(value) || 0;
                    return [`${numValue >= 0 ? '+' : ''}${numValue.toFixed(2)}%`, 'Performance'];
                  }}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    color: '#18181b',
                  }}
                  labelStyle={{ color: '#18181b', fontWeight: 600 }}
                />
                <Bar 
                  dataKey="gainPercent" 
                  fill="#10b981"
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                >
                  {perfChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graphique des poids */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Scale className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
              Poids dans le Portefeuille
            </h3>
          </div>
          <div className="h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={weightChartData} 
                layout="vertical"
                margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={true} vertical={false} />
                <XAxis 
                  type="number" 
                  domain={[0, 'dataMax + 5']}
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                  tick={{ fontSize: 10 }}
                  stroke="#9ca3af"
                />
                <YAxis 
                  type="category" 
                  dataKey="symbol" 
                  tick={{ fontSize: 11, fontWeight: 500 }}
                  stroke="#9ca3af"
                  width={50}
                />
                <Tooltip 
                  formatter={(value, name, props) => {
                    const numValue = Number(value) || 0;
                    const data = props.payload;
                    return [`${numValue.toFixed(1)}% (${formatCurrency(data.value)})`, 'Poids'];
                  }}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    color: '#18181b',
                  }}
                  labelStyle={{ color: '#18181b', fontWeight: 600 }}
                />
                <Bar 
                  dataKey="weight" 
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                >
                  {weightChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tableau détaillé */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            Détail par Position
          </h3>
        </div>
        
        {/* Version mobile: cartes */}
        <div className="sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          {sortedByValue.map((m) => {
            const isExpanded = expandedSymbol === m.symbol;
            const stats = getTransactionStats(m.symbol);
            
            return (
              <div key={m.symbol} className="p-3 space-y-2">
                <div 
                  className="flex justify-between items-start cursor-pointer"
                  onClick={() => setExpandedSymbol(isExpanded ? null : m.symbol)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-zinc-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-zinc-400" />
                    )}
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">{m.symbol}</p>
                      <p className="text-xs text-zinc-500 truncate max-w-[150px]">{m.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(m.currentValue)}</p>
                    <p className="text-xs text-zinc-500">{m.weight.toFixed(1)}% du portefeuille</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-zinc-500">Qté × PRU</p>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {m.quantity.toFixed(m.quantity % 1 === 0 ? 0 : 2)} × {formatCurrency(m.avgPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Cours actuel</p>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(m.currentPrice)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Var. jour</p>
                    <p className={`font-medium ${m.dayChangePercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.dayChangePercent >= 0 ? '+' : ''}{formatPercent(m.dayChangePercent)}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs text-zinc-500">+/- Value</span>
                  <span className={`font-semibold ${m.gainPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {m.gainPercent >= 0 ? '+' : ''}{formatCurrency(m.gainValue)} ({formatPercent(m.gainPercent)})
                  </span>
                </div>
                
                {/* Détails des transactions (version mobile) */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 space-y-3">
                    {/* Statistiques résumées */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded p-2">
                        <p className="text-emerald-600 dark:text-emerald-400 font-medium">Achats</p>
                        <p className="text-zinc-900 dark:text-zinc-100">{stats.buys.length} ordres • {stats.totalBought.toFixed(2)} titres</p>
                        <p className="text-zinc-600 dark:text-zinc-400">{formatCurrency(stats.totalBuyAmount)}</p>
                      </div>
                      {stats.sells.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/20 rounded p-2">
                          <p className="text-red-600 dark:text-red-400 font-medium">Ventes</p>
                          <p className="text-zinc-900 dark:text-zinc-100">{stats.sells.length} ordres • {stats.totalSold.toFixed(2)} titres</p>
                          <p className="text-zinc-600 dark:text-zinc-400">{formatCurrency(stats.totalSellAmount)}</p>
                        </div>
                      )}
                      {stats.totalDividends > 0 && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                          <p className="text-blue-600 dark:text-blue-400 font-medium">Dividendes</p>
                          <p className="text-zinc-900 dark:text-zinc-100">{stats.dividends.length} versements</p>
                          <p className="text-zinc-600 dark:text-zinc-400">{formatCurrency(stats.totalDividends)}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Liste des transactions */}
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Historique</p>
                      {stats.allTransactions.slice(0, 10).map((t) => (
                        <div key={t.id} className="flex justify-between items-center text-xs py-1 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              t.type === 'BUY' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                              t.type === 'SELL' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              t.type === 'DIVIDEND' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                            }`}>
                              {t.type === 'BUY' ? 'Achat' : t.type === 'SELL' ? 'Vente' : t.type === 'DIVIDEND' ? 'Div.' : t.type}
                            </span>
                            <span className="text-zinc-500">{new Date(t.date).toLocaleDateString('fr-FR')}</span>
                          </div>
                          <div className="text-right">
                            {t.quantity && t.price_per_unit && (
                              <span className="text-zinc-600 dark:text-zinc-400 mr-2">{t.quantity} × {formatCurrency(t.price_per_unit)}</span>
                            )}
                            <span className={`font-medium ${t.type === 'SELL' || t.type === 'DIVIDEND' ? 'text-emerald-600' : 'text-zinc-900 dark:text-zinc-100'}`}>
                              {t.type === 'SELL' || t.type === 'DIVIDEND' ? '+' : '-'}{formatCurrency(Math.abs(t.amount))}
                            </span>
                          </div>
                        </div>
                      ))}
                      {stats.allTransactions.length > 10 && (
                        <p className="text-[10px] text-zinc-400 text-center pt-1">
                          +{stats.allTransactions.length - 10} autres transactions
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Version desktop: tableau */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="py-2 px-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">Action</th>
                <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Qté</th>
                <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">PRU</th>
                <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Cours</th>
                <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Var. Jour</th>
                <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Valeur</th>
                <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Poids</th>
                <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">+/- Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sortedByValue.map((m) => {
                const isExpanded = expandedSymbol === m.symbol;
                const stats = getTransactionStats(m.symbol);
                
                return (
                  <React.Fragment key={m.symbol}>
                    <tr 
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedSymbol(isExpanded ? null : m.symbol)}
                    >
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                          )}
                          <div>
                            <p className="font-semibold text-zinc-900 dark:text-zinc-100">{m.symbol}</p>
                            <p className="text-xs text-zinc-500 truncate max-w-[120px]">{m.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100">
                        {m.quantity.toFixed(m.quantity % 1 === 0 ? 0 : 2)}
                      </td>
                      <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(m.avgPrice)}
                      </td>
                      <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(m.currentPrice)}
                      </td>
                      <td className={`py-2 px-3 text-right font-medium ${m.dayChangePercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        <span className="flex items-center justify-end gap-1">
                          {m.dayChangePercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {formatPercent(m.dayChangePercent)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(m.currentValue)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-12 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full"
                              style={{ width: `${m.weight}%`, backgroundColor: m.color }}
                            />
                          </div>
                          <span className="text-zinc-600 dark:text-zinc-400 w-10 text-right">
                            {m.weight.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold ${m.gainPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        <p>{m.gainPercent >= 0 ? '+' : ''}{formatCurrency(m.gainValue)}</p>
                        <p className="text-xs font-normal">{formatPercent(m.gainPercent)}</p>
                      </td>
                    </tr>
                    
                    {/* Ligne de détail extensible */}
                    {isExpanded && (
                      <tr className="bg-zinc-50/80 dark:bg-zinc-800/30">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="space-y-4">
                            {/* Résumé des transactions */}
                            <div className="grid grid-cols-4 gap-4">
                              <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                                <div className="flex items-center gap-2 mb-2">
                                  <ShoppingCart className="h-4 w-4 text-emerald-600" />
                                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Achats</span>
                                </div>
                                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{stats.buys.length} ordres</p>
                                <p className="text-sm text-zinc-500">{stats.totalBought.toFixed(2)} titres achetés</p>
                                <p className="text-sm font-medium text-emerald-600">{formatCurrency(stats.totalBuyAmount)}</p>
                              </div>
                              
                              <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                                <div className="flex items-center gap-2 mb-2">
                                  <DollarSign className="h-4 w-4 text-red-600" />
                                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Ventes</span>
                                </div>
                                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{stats.sells.length} ordres</p>
                                <p className="text-sm text-zinc-500">{stats.totalSold.toFixed(2)} titres vendus</p>
                                <p className="text-sm font-medium text-red-600">{formatCurrency(stats.totalSellAmount)}</p>
                              </div>
                              
                              <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                                <div className="flex items-center gap-2 mb-2">
                                  <Banknote className="h-4 w-4 text-blue-600" />
                                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Dividendes</span>
                                </div>
                                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{stats.dividends.length} versements</p>
                                <p className="text-sm text-zinc-500">Total perçu</p>
                                <p className="text-sm font-medium text-blue-600">{formatCurrency(stats.totalDividends)}</p>
                              </div>
                              
                              <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                                <div className="flex items-center gap-2 mb-2">
                                  <Percent className="h-4 w-4 text-purple-600" />
                                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Rendement Total</span>
                                </div>
                                <p className={`text-lg font-bold ${(m.gainValue + stats.totalDividends) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {(m.gainValue + stats.totalDividends) >= 0 ? '+' : ''}{formatCurrency(m.gainValue + stats.totalDividends)}
                                </p>
                                <p className="text-sm text-zinc-500">+/- value + dividendes</p>
                                <p className="text-sm font-medium text-purple-600">
                                  {m.investedValue > 0 ? formatPercent(((m.gainValue + stats.totalDividends) / m.investedValue) * 100) : '0%'}
                                </p>
                              </div>
                            </div>
                            
                            {/* Tableau des transactions */}
                            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                              <div className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                                <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                                  Historique des transactions ({stats.allTransactions.length})
                                </h4>
                              </div>
                              <div className="max-h-64 overflow-y-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0">
                                    <tr>
                                      <th className="py-2 px-3 text-left text-xs font-medium text-zinc-500">Date</th>
                                      <th className="py-2 px-3 text-left text-xs font-medium text-zinc-500">Type</th>
                                      <th className="py-2 px-3 text-right text-xs font-medium text-zinc-500">Quantité</th>
                                      <th className="py-2 px-3 text-right text-xs font-medium text-zinc-500">Prix unitaire</th>
                                      <th className="py-2 px-3 text-right text-xs font-medium text-zinc-500">Montant</th>
                                      <th className="py-2 px-3 text-left text-xs font-medium text-zinc-500">Description</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {stats.allTransactions.map((t) => (
                                      <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                                        <td className="py-2 px-3 text-zinc-600 dark:text-zinc-400">
                                          {new Date(t.date).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td className="py-2 px-3">
                                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                            t.type === 'BUY' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            t.type === 'SELL' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                            t.type === 'DIVIDEND' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                            'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                                          }`}>
                                            {t.type === 'BUY' && <ShoppingCart className="h-3 w-3" />}
                                            {t.type === 'SELL' && <DollarSign className="h-3 w-3" />}
                                            {t.type === 'DIVIDEND' && <Banknote className="h-3 w-3" />}
                                            {t.type === 'BUY' ? 'Achat' : t.type === 'SELL' ? 'Vente' : t.type === 'DIVIDEND' ? 'Dividende' : t.type}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100">
                                          {t.quantity ? t.quantity.toFixed(t.quantity % 1 === 0 ? 0 : 4) : '-'}
                                        </td>
                                        <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100">
                                          {t.price_per_unit ? formatCurrency(t.price_per_unit) : '-'}
                                        </td>
                                        <td className={`py-2 px-3 text-right font-medium ${
                                          t.type === 'SELL' || t.type === 'DIVIDEND' ? 'text-emerald-600' : 'text-zinc-900 dark:text-zinc-100'
                                        }`}>
                                          {t.type === 'SELL' || t.type === 'DIVIDEND' ? '+' : '-'}{formatCurrency(Math.abs(t.amount))}
                                        </td>
                                        <td className="py-2 px-3 text-zinc-500 truncate max-w-[200px]">
                                          {t.description || '-'}
                                        </td>
                                      </tr>
                                    ))}
                                    {stats.allTransactions.length === 0 && (
                                      <tr>
                                        <td colSpan={6} className="py-8 text-center text-zinc-500">
                                          Aucune transaction pour cette action
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===== STOCK HISTORY CHART =====
// Graphique d'évolution des cours des actions individuelles

interface StockHistoryChartProps {
  history: PortfolioHistoryPoint[];
  loading?: boolean;
  onPeriodChange?: (days: number) => void;
  selectedPeriod?: number;
}

// Couleurs pour les différentes actions
const STOCK_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
];

const TOTAL_COLOR = '#9333EA'; // Couleur pour le total (violet vif, très visible)

export function StockHistoryChart({ 
  history, 
  loading = false,
  onPeriodChange,
  selectedPeriod = 30
}: StockHistoryChartProps) {
  const periods = [
    { label: '1M', days: 30 },
    { label: '3M', days: 90 },
    { label: '6M', days: 180 },
    { label: '1A', days: 365 },
    { label: 'Max', days: 3650 },
  ];

  // Extraire tous les symboles uniques depuis l'historique
  const symbols = useMemo(() => {
    const symbolSet = new Set<string>();
    history.forEach(point => {
      point.positions.forEach(pos => symbolSet.add(pos.symbol));
    });
    return Array.from(symbolSet);
  }, [history]);

  // État pour les symboles sélectionnés (tous sélectionnés par défaut + Total)
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set(['__TOTAL__', ...symbols]));
  
  // Mettre à jour les symboles sélectionnés quand les symboles changent
  useMemo(() => {
    setSelectedSymbols(prev => {
      const newSet = new Set(prev);
      // Ajouter les nouveaux symboles
      symbols.forEach(s => {
        if (!prev.has(s) && prev.size === 0) {
          newSet.add(s);
        }
      });
      // Garder __TOTAL__ si c'était sélectionné
      if (prev.has('__TOTAL__')) {
        newSet.add('__TOTAL__');
      }
      return newSet;
    });
  }, [symbols]);

  // Toggle un symbole
  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols(prev => {
      const newSet = new Set(prev);
      if (newSet.has(symbol)) {
        newSet.delete(symbol);
      } else {
        newSet.add(symbol);
      }
      return newSet;
    });
  };

  // Sélectionner uniquement un symbole (isoler)
  const isolateSymbol = (symbol: string) => {
    setSelectedSymbols(new Set([symbol]));
  };

  // Tout sélectionner / Tout désélectionner
  const toggleAll = () => {
    if (selectedSymbols.size === symbols.length + 1) {
      setSelectedSymbols(new Set());
    } else {
      setSelectedSymbols(new Set(['__TOTAL__', ...symbols]));
    }
  };

  // Trouver le prix de base = premier prix où l'action EST DÉTENUE (quantity > 0)
  const basePrices = useMemo(() => {
    const bases: Record<string, number> = {};
    
    if (history.length === 0) return bases;
    
    symbols.forEach(symbol => {
      // Chercher le premier point où l'action est réellement détenue
      for (const point of history) {
        const position = point.positions.find(p => p.symbol === symbol);
        // L'action doit avoir une quantité > 0 ET un prix > 0
        if (position && position.quantity > 0 && position.price > 0) {
          bases[symbol] = position.price;
          break;
        }
      }
    });
    
    return bases;
  }, [history, symbols]);

  // Valeur totale de base pour le portefeuille (premier point avec une valeur > 0)
  const baseTotalValue = useMemo(() => {
    if (history.length === 0) return 0;
    // Trouver le premier point où stocksValue > 0
    for (const point of history) {
      if (point.stocksValue > 0) {
        return point.stocksValue;
      }
    }
    return 0;
  }, [history]);

  // Transformer les données pour le graphique
  const chartData = useMemo(() => {
    return history.map((point) => {
      const dataPoint: Record<string, number | string> = {
        date: new Date(point.date).toLocaleDateString('fr-FR', { 
          day: '2-digit', 
          month: 'short',
          year: '2-digit'
        }),
        fullDate: new Date(point.date).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }),
      };
      
      // Calculer la variation en % pour chaque position (seulement si détenue)
      symbols.forEach(symbol => {
        const basePrice = basePrices[symbol];
        const pos = point.positions.find(p => p.symbol === symbol);
        
        // Afficher seulement si l'action est détenue (quantity > 0)
        if (pos && pos.quantity > 0 && basePrice && basePrice > 0 && pos.price > 0) {
          const variation = ((pos.price - basePrice) / basePrice) * 100;
          dataPoint[symbol] = variation;
          // Stocker les infos supplémentaires pour le tooltip
          dataPoint[`${symbol}_gain`] = (pos.price - basePrice) * pos.quantity; // Gain/perte en €
          dataPoint[`${symbol}_basePrice`] = basePrice;
          dataPoint[`${symbol}_currentPrice`] = pos.price;
          dataPoint[`${symbol}_quantity`] = pos.quantity;
        }
        // Si pas détenue, on ne met pas de valeur = ligne interrompue
      });
      
      // Calculer la variation du portefeuille total (basé sur stocksValue)
      if (baseTotalValue > 0 && point.stocksValue > 0) {
        const totalVariation = ((point.stocksValue - baseTotalValue) / baseTotalValue) * 100;
        dataPoint['__TOTAL__'] = totalVariation;
        // Stocker le gain/perte total en €
        dataPoint['__TOTAL___gain'] = point.stocksValue - baseTotalValue;
        dataPoint['__TOTAL___baseValue'] = baseTotalValue;
        dataPoint['__TOTAL___currentValue'] = point.stocksValue;
      } else if (baseTotalValue > 0) {
        // Afficher 0% si pas encore de stocks mais base existe
        dataPoint['__TOTAL__'] = 0;
        dataPoint['__TOTAL___gain'] = 0;
      }
      
      return dataPoint;
    });
  }, [history, symbols, basePrices, baseTotalValue]);

  // Calculer la performance de chaque action sur la période
  const stockPerformance = useMemo(() => {
    if (history.length < 2) return {};
    
    const perf: Record<string, { startPrice: number; endPrice: number; changePercent: number }> = {};
    
    symbols.forEach(symbol => {
      const basePrice = basePrices[symbol];
      if (!basePrice) return;
      
      let endPrice = basePrice;
      for (let i = history.length - 1; i >= 0; i--) {
        const pos = history[i].positions.find(p => p.symbol === symbol);
        if (pos && pos.price > 0) {
          endPrice = pos.price;
          break;
        }
      }
      
      const changePercent = ((endPrice - basePrice) / basePrice) * 100;
      perf[symbol] = { startPrice: basePrice, endPrice, changePercent };
    });

    // Performance du total
    if (baseTotalValue > 0 && history.length > 0) {
      const endTotalValue = history[history.length - 1].stocksValue;
      const totalChangePercent = ((endTotalValue - baseTotalValue) / baseTotalValue) * 100;
      perf['__TOTAL__'] = { startPrice: baseTotalValue, endPrice: endTotalValue, changePercent: totalChangePercent };
    }
    
    return perf;
  }, [history, symbols, basePrices, baseTotalValue]);

  // Calculer min/max pour l'axe Y (seulement pour les symboles sélectionnés)
  const yDomain = useMemo(() => {
    let min = 0;
    let max = 0;
    
    const allKeys = ['__TOTAL__', ...symbols];
    
    chartData.forEach(point => {
      allKeys.forEach(key => {
        if (selectedSymbols.has(key)) {
          const value = point[key] as number;
          if (typeof value === 'number') {
            min = Math.min(min, value);
            max = Math.max(max, value);
          }
        }
      });
    });
    
    const padding = Math.max(Math.abs(max - min) * 0.1, 5);
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [chartData, symbols, selectedSymbols]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Évolution des Actions
          </h3>
        </div>
        <div className="flex items-center justify-center py-8 sm:py-12">
          <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 animate-spin" />
          <span className="ml-2 text-sm text-zinc-500">Chargement...</span>
        </div>
      </div>
    );
  }

  if (symbols.length === 0 || history.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Évolution des Actions
          </h3>
        </div>
        <div className="text-center py-8 sm:py-12">
          <TrendingUp className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
          <p className="mt-3 sm:mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Ajoutez des transactions pour voir l&apos;évolution de vos actions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Variation des Actions (%)
          </h3>
        </div>
        
        {/* Sélecteur de période */}
        {onPeriodChange && (
          <div className="flex gap-1">
            {periods.map((period) => (
              <button
                key={period.days}
                onClick={() => onPeriodChange(period.days)}
                className={`px-2 py-1 text-[10px] sm:text-xs rounded transition-colors ${
                  selectedPeriod === period.days
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sélecteur d'actions */}
      <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-700">
        <button
          onClick={toggleAll}
          className="px-2 py-1 text-[10px] sm:text-xs rounded border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          {selectedSymbols.size === symbols.length + 1 ? 'Tout masquer' : 'Tout afficher'}
        </button>
        
        {/* Bouton Total Portefeuille */}
        <button
          onClick={() => toggleSymbol('__TOTAL__')}
          onDoubleClick={() => isolateSymbol('__TOTAL__')}
          className={`px-2 py-1 text-[10px] sm:text-xs rounded flex items-center gap-1 transition-all ${
            selectedSymbols.has('__TOTAL__')
              ? 'ring-2 ring-offset-1 ring-zinc-400 dark:ring-zinc-500'
              : 'opacity-40'
          }`}
          style={{ 
            backgroundColor: selectedSymbols.has('__TOTAL__') ? TOTAL_COLOR : '#e5e7eb',
            color: selectedSymbols.has('__TOTAL__') ? 'white' : '#6b7280'
          }}
          title="Clic: afficher/masquer • Double-clic: isoler"
        >
          <span className="font-semibold">TOTAL</span>
          {stockPerformance['__TOTAL__'] && (
            <span className={stockPerformance['__TOTAL__'].changePercent >= 0 ? 'text-emerald-300' : 'text-red-300'}>
              {stockPerformance['__TOTAL__'].changePercent >= 0 ? '+' : ''}
              {stockPerformance['__TOTAL__'].changePercent.toFixed(1)}%
            </span>
          )}
        </button>

        {/* Boutons par action */}
        {symbols.map((symbol, index) => {
          const perf = stockPerformance[symbol];
          const isSelected = selectedSymbols.has(symbol);
          const color = STOCK_COLORS[index % STOCK_COLORS.length];
          
          return (
            <button
              key={symbol}
              onClick={() => toggleSymbol(symbol)}
              onDoubleClick={() => isolateSymbol(symbol)}
              className={`px-2 py-1 text-[10px] sm:text-xs rounded flex items-center gap-1 transition-all ${
                isSelected
                  ? 'ring-2 ring-offset-1'
                  : 'opacity-40'
              }`}
              style={{ 
                backgroundColor: isSelected ? color : '#e5e7eb',
                color: isSelected ? 'white' : '#6b7280',
                // @ts-ignore - ringColor via CSS custom property
                '--tw-ring-color': color
              } as React.CSSProperties}
              title="Clic: afficher/masquer • Double-clic: isoler"
            >
              <span className="font-medium">{symbol}</span>
              {perf && (
                <span className={perf.changePercent >= 0 ? 'text-emerald-200' : 'text-red-200'}>
                  {perf.changePercent >= 0 ? '+' : ''}{perf.changePercent.toFixed(1)}%
                </span>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Graphique principal */}
      <div className="h-[280px] sm:h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10 }}
              stroke="#9ca3af"
              interval="preserveStartEnd"
            />
            <YAxis 
              domain={yDomain}
              tickFormatter={(value) => `${value > 0 ? '+' : ''}${value.toFixed(0)}%`}
              tick={{ fontSize: 10 }}
              stroke="#9ca3af"
              width={50}
            />
            <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1} strokeDasharray="3 3" />
            <Tooltip 
              formatter={(value, name, props) => {
                const numValue = Number(value) || 0;
                const displayName = name === '__TOTAL__' ? 'Portefeuille Total' : name;
                const payload = props.payload;
                
                // Récupérer le gain/perte en €
                const gainKey = name === '__TOTAL__' ? '__TOTAL___gain' : `${name}_gain`;
                const gain = payload[gainKey] as number | undefined;
                
                let details = `${numValue >= 0 ? '+' : ''}${numValue.toFixed(2)}%`;
                
                if (gain !== undefined) {
                  details += ` (${gain >= 0 ? '+' : ''}${gain.toFixed(2)} €)`;
                }
                
                // Ajouter les détails du prix pour les actions individuelles
                if (name !== '__TOTAL__') {
                  const basePrice = payload[`${name}_basePrice`] as number | undefined;
                  const currentPrice = payload[`${name}_currentPrice`] as number | undefined;
                  const quantity = payload[`${name}_quantity`] as number | undefined;
                  
                  if (basePrice && currentPrice && quantity) {
                    details += `\n${quantity} × ${currentPrice.toFixed(2)}€ (base: ${basePrice.toFixed(2)}€)`;
                  }
                } else {
                  // Détails pour le total
                  const baseValue = payload['__TOTAL___baseValue'] as number | undefined;
                  const currentValue = payload['__TOTAL___currentValue'] as number | undefined;
                  
                  if (baseValue && currentValue) {
                    details += `\n${currentValue.toFixed(2)}€ (base: ${baseValue.toFixed(2)}€)`;
                  }
                }
                
                return [details, displayName];
              }}
              labelFormatter={(_, payload) => {
                if (payload && payload.length > 0) {
                  return payload[0].payload.fullDate;
                }
                return '';
              }}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                color: '#18181b',
                whiteSpace: 'pre-line',
              }}
              labelStyle={{
                color: '#18181b',
                fontWeight: 600,
                marginBottom: '4px',
              }}
            />
            
            {/* Courbe Total Portefeuille - plus visible */}
            {selectedSymbols.has('__TOTAL__') && (
              <Line 
                type="monotone" 
                dataKey="__TOTAL__" 
                stroke={TOTAL_COLOR}
                strokeWidth={3}
                dot={false}
                name="__TOTAL__"
                connectNulls={false}
              />
            )}
            
            {/* Courbes par action */}
            {symbols.map((symbol, index) => (
              selectedSymbols.has(symbol) && (
                <Line 
                  key={symbol}
                  type="monotone" 
                  dataKey={symbol} 
                  stroke={STOCK_COLORS[index % STOCK_COLORS.length]} 
                  strokeWidth={2}
                  dot={false}
                  name={symbol}
                  connectNulls={false}
                />
              )
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Légende informative */}
      <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
        <p className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500">
          💡 Cliquez sur une action pour l&apos;afficher/masquer • Double-cliquez pour l&apos;isoler
        </p>
      </div>
    </div>
  );
}

// ===== PORTFOLIO REAL PERFORMANCE CHART =====
// Graphique de la performance réelle du portefeuille (hors apports)

interface PortfolioPerformanceChartProps {
  transactions: Transaction[];
  portfolioHistory: PortfolioHistoryPoint[];
  accounts: Account[];
  loading?: boolean;
  currentPortfolioValue?: number; // Valeur actuelle en temps réel
}

export function PortfolioPerformanceChart({ 
  transactions, 
  portfolioHistory, 
  accounts,
  loading = false,
  currentPortfolioValue
}: PortfolioPerformanceChartProps) {
  // État pour afficher/masquer les années précédentes
  const [showAllYears, setShowAllYears] = useState(false);
  
  // Calculer la performance
  const performance = useMemo(() => {
    const basePerformance = calculatePortfolioPerformance(transactions, portfolioHistory, accounts);
    
    // Si on a une valeur actuelle en temps réel, corriger la endValue de l'année en cours
    if (currentPortfolioValue !== undefined && basePerformance.currentYearPerformance) {
      const correctedCurrentYear = {
        ...basePerformance.currentYearPerformance,
        endValue: currentPortfolioValue,
        gainLoss: currentPortfolioValue - basePerformance.currentYearPerformance.startValue - basePerformance.currentYearPerformance.netFlows,
        gainLossPercent: 0,
        totalReturn: 0,
        totalReturnPercent: 0,
      };
      
      // Recalculer les pourcentages
      const avgCapital = correctedCurrentYear.startValue + (correctedCurrentYear.netFlows / 2);
      if (avgCapital > 0) {
        correctedCurrentYear.gainLossPercent = (correctedCurrentYear.gainLoss / avgCapital) * 100;
        correctedCurrentYear.totalReturn = correctedCurrentYear.gainLoss + correctedCurrentYear.dividends;
        correctedCurrentYear.totalReturnPercent = (correctedCurrentYear.totalReturn / avgCapital) * 100;
      }
      
      return {
        ...basePerformance,
        currentValue: currentPortfolioValue,
        currentYearPerformance: correctedCurrentYear,
        yearlyPerformance: basePerformance.yearlyPerformance.map(y => 
          y.year === correctedCurrentYear.year ? correctedCurrentYear : y
        ),
      };
    }
    
    return basePerformance;
  }, [transactions, portfolioHistory, accounts, currentPortfolioValue]);

  // Trier les années de la plus récente à la plus ancienne
  const sortedYears = useMemo(() => {
    return [...performance.yearlyPerformance].sort((a, b) => b.year - a.year);
  }, [performance.yearlyPerformance]);

  // Années à afficher dans le tableau (2 dernières ou toutes)
  const displayedYears = useMemo(() => {
    if (showAllYears || sortedYears.length <= 2) {
      return sortedYears;
    }
    return sortedYears.slice(0, 2); // Année en cours + année précédente
  }, [sortedYears, showAllYears]);

  // Données pour le graphique bar (5 dernières années max)
  const yearlyChartData = useMemo(() => {
    const recentYears = [...performance.yearlyPerformance]
      .sort((a, b) => b.year - a.year)
      .slice(0, 5)
      .reverse();
    return recentYears.map(y => ({
      year: y.year.toString(),
      performance: y.gainLossPercent,
      totalReturn: y.totalReturnPercent,
      gainLoss: y.gainLoss,
      dividends: y.dividends,
    }));
  }, [performance.yearlyPerformance]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <LineChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Performance Annuelle
          </h3>
        </div>
        <div className="flex items-center justify-center py-8 sm:py-12">
          <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-600 animate-spin" />
          <span className="ml-2 text-sm text-zinc-500">Calcul en cours...</span>
        </div>
      </div>
    );
  }

  if (portfolioHistory.length === 0 || performance.yearlyPerformance.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <LineChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
          <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
            Performance Annuelle
          </h3>
        </div>
        <div className="text-center py-8 sm:py-12">
          <TrendingUp className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
          <p className="mt-3 sm:mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Ajoutez des transactions pour voir votre performance
          </p>
        </div>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <LineChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
        <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
          Performance Annuelle (hors apports)
        </h3>
      </div>

      {/* Performance année en cours en évidence */}
      {performance.currentYearPerformance && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-indigo-100 text-sm font-medium mb-1">📅 Année {currentYear} (en cours)</p>
              <div className="flex items-baseline gap-3">
                <p className={`text-3xl sm:text-4xl font-bold ${performance.currentYearPerformance.gainLossPercent >= 0 ? 'text-white' : 'text-red-200'}`}>
                  {performance.currentYearPerformance.gainLossPercent >= 0 ? '+' : ''}{performance.currentYearPerformance.gainLossPercent.toFixed(2)}%
                </p>
                <p className="text-indigo-200 text-sm">
                  ({performance.currentYearPerformance.gainLoss >= 0 ? '+' : ''}{formatCurrency(performance.currentYearPerformance.gainLoss)})
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-indigo-200 text-xs">Début année</p>
                <p className="text-lg font-semibold">{formatCurrency(performance.currentYearPerformance.startValue)}</p>
              </div>
              <div>
                <p className="text-indigo-200 text-xs">Valeur actuelle</p>
                <p className="text-lg font-semibold">{formatCurrency(performance.currentYearPerformance.endValue)}</p>
              </div>
              <div>
                <p className="text-indigo-200 text-xs">Dividendes</p>
                <p className="text-lg font-semibold text-emerald-300">+{formatCurrency(performance.currentYearPerformance.dividends)}</p>
              </div>
            </div>
          </div>
          {performance.currentYearPerformance.netFlows !== 0 && (
            <p className="text-indigo-200 text-xs mt-3 pt-3 border-t border-indigo-400/30">
              Apports nets cette année : {performance.currentYearPerformance.netFlows >= 0 ? '+' : ''}{formatCurrency(performance.currentYearPerformance.netFlows)}
              {' '}(déjà exclus du calcul de performance)
            </p>
          )}
        </div>
      )}

      {/* Graphique des performances par année */}
      {yearlyChartData.length > 1 && (
        <div className="h-[200px] sm:h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearlyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="year" 
                tick={{ fontSize: 12 }}
                stroke="#9ca3af"
              />
              <YAxis 
                tickFormatter={(value) => `${value >= 0 ? '+' : ''}${value.toFixed(0)}%`}
                tick={{ fontSize: 10 }}
                stroke="#9ca3af"
                width={50}
              />
              <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1} />
              <Tooltip 
                formatter={(value, name) => {
                  const numValue = Number(value);
                  if (name === 'performance') {
                    return [`${numValue >= 0 ? '+' : ''}${numValue.toFixed(2)}%`, 'Performance'];
                  }
                  if (name === 'totalReturn') {
                    return [`${numValue >= 0 ? '+' : ''}${numValue.toFixed(2)}%`, 'Avec dividendes'];
                  }
                  return [formatCurrency(numValue), name === 'gainLoss' ? 'Gain/Perte' : 'Dividendes'];
                }}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  color: '#18181b',
                }}
              />
              <Bar 
                dataKey="performance" 
                name="performance"
                radius={[4, 4, 0, 0]}
              >
                {yearlyChartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.performance >= 0 ? '#10b981' : '#ef4444'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tableau détaillé par année */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50">
            <tr>
              <th className="py-2 px-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">Année</th>
              <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Début</th>
              <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Fin</th>
              <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Apports</th>
              <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Gain/Perte</th>
              <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Performance</th>
              <th className="py-2 px-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Dividendes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {displayedYears.map((year) => (
              <tr 
                key={year.year} 
                className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${
                  year.year === currentYear ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''
                }`}
              >
                <td className="py-2 px-3 font-semibold text-zinc-900 dark:text-zinc-100">
                  {year.year}
                  {year.year === currentYear && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                      En cours
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-right text-zinc-600 dark:text-zinc-400">
                  {formatCurrency(year.startValue)}
                </td>
                <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100 font-medium">
                  {formatCurrency(year.endValue)}
                </td>
                <td className="py-2 px-3 text-right text-zinc-600 dark:text-zinc-400">
                  {year.netFlows >= 0 ? '+' : ''}{formatCurrency(year.netFlows)}
                </td>
                <td className={`py-2 px-3 text-right font-medium ${year.gainLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {year.gainLoss >= 0 ? '+' : ''}{formatCurrency(year.gainLoss)}
                </td>
                <td className={`py-2 px-3 text-right font-bold ${year.gainLossPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {year.gainLossPercent >= 0 ? '+' : ''}{year.gainLossPercent.toFixed(2)}%
                </td>
                <td className="py-2 px-3 text-right text-blue-600">
                  +{formatCurrency(year.dividends)}
                </td>
              </tr>
            ))}
          </tbody>
          {/* Bouton pour voir plus d'années */}
          {sortedYears.length > 2 && (
            <tfoot>
              <tr>
                <td colSpan={7} className="py-2 px-3">
                  <button
                    onClick={() => setShowAllYears(!showAllYears)}
                    className="w-full text-center text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium py-1"
                  >
                    {showAllYears ? (
                      <span className="flex items-center justify-center gap-1">
                        <ChevronDown className="h-4 w-4 rotate-180" />
                        Masquer les années précédentes
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1">
                        <ChevronDown className="h-4 w-4" />
                        Voir les {sortedYears.length - 2} années précédentes
                      </span>
                    )}
                  </button>
                </td>
              </tr>
            </tfoot>
          )}
          {/* Total global */}
          <tfoot className="bg-zinc-100 dark:bg-zinc-800 font-semibold">
            <tr>
              <td className="py-2 px-3 text-zinc-900 dark:text-zinc-100">Total</td>
              <td className="py-2 px-3 text-right text-zinc-600 dark:text-zinc-400">-</td>
              <td className="py-2 px-3 text-right text-zinc-900 dark:text-zinc-100">
                {formatCurrency(performance.currentValue)}
              </td>
              <td className="py-2 px-3 text-right text-zinc-600 dark:text-zinc-400">
                {formatCurrency(performance.netDeposits)}
              </td>
              <td className={`py-2 px-3 text-right ${performance.absoluteGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {performance.absoluteGain >= 0 ? '+' : ''}{formatCurrency(performance.absoluteGain)}
              </td>
              <td className={`py-2 px-3 text-right ${performance.absoluteGainPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {performance.absoluteGainPercent >= 0 ? '+' : ''}{performance.absoluteGainPercent.toFixed(2)}%
              </td>
              <td className="py-2 px-3 text-right text-blue-600">
                +{formatCurrency(performance.totalDividends)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

