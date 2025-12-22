'use client';

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
  AreaChart
} from 'recharts';
import { StockPosition, StockQuote } from '@/lib/types';
import { PortfolioHistoryPoint } from '@/lib/portfolio-calculator';
import { formatCurrency, formatPercent, CHART_COLORS, getSectorColor } from '@/lib/utils';
import { PieChart as PieChartIcon, TrendingUp, Loader2 } from 'lucide-react';

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
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex items-center gap-2 mb-4">
          <PieChartIcon className="h-5 w-5 text-zinc-400" />
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Répartition du Portefeuille
          </h3>
        </div>
        <div className="text-center py-12">
          <PieChartIcon className="mx-auto h-12 w-12 text-zinc-400" />
          <p className="mt-4 text-zinc-500 dark:text-zinc-400">
            Ajoutez des positions pour voir la répartition
          </p>
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; fullName: string; value: number } }> }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const percentage = (item.value / totalValue) * 100;
      return (
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 p-3">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.fullName}</p>
          <p className="font-medium text-zinc-900 dark:text-zinc-100 mt-1">
            {formatCurrency(item.value)} ({formatPercent(percentage).replace('+', '')})
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex items-center gap-2 mb-4">
        <PieChartIcon className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
          Répartition du Portefeuille
        </h3>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              formatter={(value) => (
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface SectorAllocationChartProps {
  positions: StockPosition[];
  quotes: Record<string, StockQuote>;
}

export function SectorAllocationChart({ positions, quotes }: SectorAllocationChartProps) {
  // Grouper par secteur
  const sectorMap: Record<string, number> = {};
  
  positions.forEach((position) => {
    const sector = position.sector || 'Non classé';
    const currentPrice = quotes[position.symbol]?.price || position.current_price;
    const value = position.quantity * currentPrice;
    sectorMap[sector] = (sectorMap[sector] || 0) + value;
  });

  const data = Object.entries(sectorMap)
    .map(([name, value], index) => ({
      name,
      value,
      color: getSectorColor(index),
    }))
    .sort((a, b) => b.value - a.value);

  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  if (data.length === 0) {
    return null;
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number } }> }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const percentage = (item.value / totalValue) * 100;
      return (
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 p-3">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</p>
          <p className="font-medium text-zinc-900 dark:text-zinc-100 mt-1">
            {formatCurrency(item.value)} ({formatPercent(percentage).replace('+', '')})
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex items-center gap-2 mb-4">
        <PieChartIcon className="h-5 w-5 text-emerald-600" />
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
          Répartition par Secteur
        </h3>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              formatter={(value) => (
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
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
      month: 'short' 
    }),
    fullDate: item.date,
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
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Évolution du Portefeuille
          </h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          <span className="ml-2 text-zinc-500">Chargement des données...</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-zinc-400" />
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Évolution du Portefeuille
          </h3>
        </div>
        <div className="text-center py-12">
          <TrendingUp className="mx-auto h-12 w-12 text-zinc-400" />
          <p className="mt-4 text-zinc-500 dark:text-zinc-400">
            Ajoutez des transactions pour voir l&apos;évolution
          </p>
        </div>
      </div>
    );
  }

  const minValue = Math.min(...data.map(d => d.totalValue)) * 0.95;
  const maxValue = Math.max(...data.map(d => d.totalValue)) * 1.05;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
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
                className={`px-2 py-1 text-xs rounded transition-colors ${
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

      {/* Performance de la période */}
      <div className="flex gap-4 mb-4 text-sm">
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
          <span className="text-zinc-500 dark:text-zinc-400">Performance: </span>
          <span className={`font-medium ${periodChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {periodChange >= 0 ? '+' : ''}{formatCurrency(periodChange)} ({formatPercent(periodChangePercent)})
          </span>
        </div>
      </div>

      <div className="h-[300px]">
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
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
            />
            <YAxis 
              domain={[minValue, maxValue]}
              tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k€` : `${value.toFixed(0)}€`}
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
            />
            <Tooltip 
              formatter={(value: number, name: string) => {
                const label = name === 'totalValue' ? 'Total' : 
                             name === 'stocksValue' ? 'Actions' : 'Épargne';
                return [formatCurrency(value), label];
              }}
              labelFormatter={(label) => `Date: ${label}`}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
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
          <span className="text-zinc-600 dark:text-zinc-400">Actions</span>
        </div>
      </div>
    </div>
  );
}
