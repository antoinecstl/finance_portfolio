'use client';

import { useMemo, useState } from 'react';
import { Transaction, StockPosition, StockQuote } from '@/lib/types';
import { formatCurrency, formatPercent, formatDate } from '@/lib/utils';
import { calculatePositionsAtDate } from '@/lib/portfolio-calculator';
import { Coins, TrendingUp, Calendar, ChevronDown, ChevronUp, PieChart } from 'lucide-react';

interface DividendSummary {
  symbol: string;
  name: string;
  totalDividends: number;
  dividendCount: number;
  lastDividendDate: string;
  lastDividendAmount: number;
  avgDividendPerShare?: number; // €/action moyen sur la période
  avgYieldOnCost?: number; // Rdt/Coût moyen sur la période
}

interface DividendsTableProps {
  transactions: Transaction[];
  positions: StockPosition[];
  quotes: Record<string, StockQuote>;
}

export function DividendsTable({ transactions, positions, quotes }: DividendsTableProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');

  // Calculer les années disponibles et totaux par année
  const { dividendsByYear, years } = useMemo(() => {
    const byYear = new Map<number, number>();
    const yearsSet = new Set<number>();

    const dividendTransactions = transactions.filter(t => t.type === 'DIVIDEND');

    dividendTransactions.forEach(t => {
      const year = new Date(t.date).getFullYear();
      yearsSet.add(year);
      byYear.set(year, (byYear.get(year) || 0) + t.amount);
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

    return {
      dividendsByYear: byYear,
      years: sortedYears,
    };
  }, [transactions]);

  // Calculer les statistiques des dividendes FILTRÉES par année
  const { dividendsByStock, totalDividends } = useMemo(() => {
    const byStock = new Map<string, DividendSummary>();

    // Filtrer les transactions de type dividende ET par année si sélectionnée
    const dividendTransactions = transactions.filter(t => {
      if (t.type !== 'DIVIDEND') return false;
      if (selectedYear === 'all') return true;
      return new Date(t.date).getFullYear() === selectedYear;
    });

    dividendTransactions.forEach(t => {
      const symbol = t.stock_symbol?.toUpperCase() || 'NON_ATTRIBUE';

      // Par action
      const existing = byStock.get(symbol) || {
        symbol,
        name: symbol,
        totalDividends: 0,
        dividendCount: 0,
        lastDividendDate: '',
        lastDividendAmount: 0,
      };

      existing.totalDividends += t.amount;
      existing.dividendCount += 1;
      
      if (t.date > existing.lastDividendDate) {
        existing.lastDividendDate = t.date;
        existing.lastDividendAmount = t.amount;
      }

      byStock.set(symbol, existing);
    });

    // Enrichir avec les noms et calculer les moyennes
    byStock.forEach((summary, symbol) => {
      const position = positions.find(p => p.symbol.toUpperCase() === symbol);
      if (position) {
        summary.name = position.name;
      }
      
      // Calculer les moyennes €/action et Rdt/Coût sur la période
      const symbolDividends = dividendTransactions.filter(t => 
        (t.stock_symbol?.toUpperCase() || 'NON_ATTRIBUE') === symbol
      );
      
      let totalDividendPerShare = 0;
      let totalYieldOnCost = 0;
      let validCount = 0;
      
      symbolDividends.forEach(t => {
        if (t.stock_symbol) {
          const positionsAtDate = calculatePositionsAtDate(transactions, t.date);
          const posAtDate = positionsAtDate.get(t.stock_symbol.toUpperCase());
          const quantityAtDate = posAtDate?.quantity || 0;
          const averagePrice = posAtDate?.averagePrice || 0;
          
          if (quantityAtDate > 0) {
            const dividendPerShare = t.amount / quantityAtDate;
            totalDividendPerShare += dividendPerShare;
            
            const costBasis = quantityAtDate * averagePrice;
            if (costBasis > 0) {
              const yieldOnCost = (t.amount / costBasis) * 100;
              totalYieldOnCost += yieldOnCost;
            }
            validCount++;
          }
        }
      });
      
      if (validCount > 0) {
        summary.avgDividendPerShare = totalDividendPerShare / validCount;
        summary.avgYieldOnCost = totalYieldOnCost / validCount;
      }
    });

    const total = dividendTransactions.reduce((sum, t) => sum + t.amount, 0);

    return {
      dividendsByStock: Array.from(byStock.values()).sort((a, b) => b.totalDividends - a.totalDividends),
      totalDividends: total,
    };
  }, [transactions, positions, quotes, selectedYear]);

  // Filtrer par année si sélectionné (pour l'historique détaillé)
  const filteredTransactions = useMemo(() => {
    const dividends = transactions.filter(t => t.type === 'DIVIDEND');
    if (selectedYear === 'all') return dividends;
    return dividends.filter(t => new Date(t.date).getFullYear() === selectedYear);
  }, [transactions, selectedYear]);

  if (dividendsByStock.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
          <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Dividendes
          </h3>
        </div>
        <div className="text-center py-6 sm:py-8">
          <Coins className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-zinc-500 dark:text-zinc-400">
            Aucun dividende enregistré
          </p>
          <p className="text-xs sm:text-sm text-zinc-400 dark:text-zinc-500 mt-1">
            Ajoutez des transactions de type "Dividende" pour voir les statistiques
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
          <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Dividendes
          </h3>
        </div>
        
        {/* Sélecteur d'année */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          className="text-xs sm:text-sm px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        >
          <option value="all">Toutes les années</option>
          {years.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Résumé global */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-lg p-2 sm:p-3">
          <div className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">Total Dividendes</div>
          <div className="text-base sm:text-xl font-bold text-emerald-700 dark:text-emerald-300">
            {formatCurrency(totalDividends)}
          </div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2 sm:p-3">
          <div className="text-xs sm:text-sm text-blue-600 dark:text-blue-400">Versements</div>
          <div className="text-base sm:text-xl font-bold text-blue-700 dark:text-blue-300">
            {filteredTransactions.length}
          </div>
        </div>
        <div className="bg-violet-50 dark:bg-violet-900/30 rounded-lg p-2 sm:p-3">
          <div className="text-xs sm:text-sm text-violet-600 dark:text-violet-400">Actions</div>
          <div className="text-base sm:text-xl font-bold text-violet-700 dark:text-violet-300">
            {dividendsByStock.filter(d => d.symbol !== 'NON_ATTRIBUE').length}
          </div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-2 sm:p-3">
          <div className="text-xs sm:text-sm text-amber-600 dark:text-amber-400">Moyenne</div>
          <div className="text-base sm:text-xl font-bold text-amber-700 dark:text-amber-300">
            {filteredTransactions.length > 0 
              ? formatCurrency(totalDividends / filteredTransactions.length)
              : '0 €'}
          </div>
        </div>
      </div>

      {/* Dividendes par année */}
      {years.length > 1 && selectedYear === 'all' && (
        <div className="mb-4 sm:mb-6">
          <h4 className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Évolution par année
          </h4>
          <div className="flex gap-2 flex-wrap">
            {years.map(year => {
              const amount = dividendsByYear.get(year) || 0;
              const maxAmount = Math.max(...Array.from(dividendsByYear.values()));
              const percentage = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
              
              return (
                <div key={year} className="flex-1 min-w-[80px]">
                  <div className="text-xs text-zinc-500 mb-1">{year}</div>
                  <div className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded relative">
                    <div 
                      className="absolute bottom-0 left-0 right-0 bg-emerald-500 rounded"
                      style={{ height: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mt-1">
                    {formatCurrency(amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tableau par action */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="text-left py-2 px-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">Action</th>
              <th className="text-right py-2 px-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">Total reçu</th>
              <th className="text-right py-2 px-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">Versements</th>
              <th className="text-right py-2 px-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hidden md:table-cell">Moy. €/action</th>
              <th className="text-right py-2 px-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hidden lg:table-cell">Moy. Rdt/Coût</th>
              <th className="text-right py-2 px-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hidden xl:table-cell">Dernier</th>
            </tr>
          </thead>
          <tbody>
            {dividendsByStock.map((dividend) => (
              <tr key={dividend.symbol} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="py-3 px-2">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {dividend.symbol === 'NON_ATTRIBUE' ? '(Non attribué)' : dividend.symbol}
                  </div>
                  <div className="text-xs text-zinc-500 truncate max-w-[120px]">
                    {dividend.symbol === 'NON_ATTRIBUE' ? 'Dividendes sans action' : dividend.name}
                  </div>
                </td>
                <td className="py-3 px-2 text-right">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(dividend.totalDividends)}
                  </span>
                </td>
                <td className="py-3 px-2 text-right text-zinc-700 dark:text-zinc-300">
                  {dividend.dividendCount}
                </td>
                <td className="py-3 px-2 text-right hidden md:table-cell">
                  {dividend.avgDividendPerShare !== undefined ? (
                    <span className="text-sm font-medium text-violet-600 dark:text-violet-400">
                      {dividend.avgDividendPerShare.toFixed(2)} €
                    </span>
                  ) : (
                    <span className="text-zinc-400">-</span>
                  )}
                </td>
                <td className="py-3 px-2 text-right hidden lg:table-cell">
                  {dividend.avgYieldOnCost !== undefined ? (
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {dividend.avgYieldOnCost.toFixed(2)}%
                    </span>
                  ) : (
                    <span className="text-zinc-400">-</span>
                  )}
                </td>
                <td className="py-3 px-2 text-right text-zinc-500 hidden xl:table-cell">
                  <div className="text-xs">{formatDate(dividend.lastDividendDate)}</div>
                  <div className="text-xs text-emerald-600">{formatCurrency(dividend.lastDividendAmount)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Historique détaillé */}
      <div className="mt-4">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showDetails ? 'Masquer' : 'Voir'} l'historique détaillé
        </button>
        
        {showDetails && (
          <div className="mt-3 max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-zinc-900">
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Date</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Action</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-zinc-500">Montant</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-zinc-500">Qté</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-zinc-500">€/action</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-zinc-500 hidden md:table-cell">Rdt/Coût</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((t) => {
                    // Calculer le nombre d'actions détenues à la date du dividende
                    const symbol = t.stock_symbol?.toUpperCase();
                    let quantityAtDate = 0;
                    let dividendPerShare = 0;
                    let yieldOnCost = 0;
                    
                    if (symbol) {
                      const positionsAtDate = calculatePositionsAtDate(transactions, t.date);
                      const position = positionsAtDate.get(symbol);
                      quantityAtDate = position?.quantity || 0;
                      const averagePrice = position?.averagePrice || 0;
                      
                      if (quantityAtDate > 0) {
                        dividendPerShare = t.amount / quantityAtDate;
                        // Rdt/Coût = Dividende / Coût total des actions à cette date
                        const costBasis = quantityAtDate * averagePrice;
                        if (costBasis > 0) {
                          yieldOnCost = (t.amount / costBasis) * 100;
                        }
                      }
                    }
                    
                    return (
                      <tr key={t.id} className="border-b border-zinc-50 dark:border-zinc-800">
                        <td className="py-2 px-2 text-zinc-600 dark:text-zinc-400">
                          {formatDate(t.date)}
                        </td>
                        <td className="py-2 px-2 font-medium text-zinc-900 dark:text-zinc-100">
                          {t.stock_symbol || '(Non attribué)'}
                        </td>
                        <td className="py-2 px-2 text-right text-emerald-600 font-medium">
                          {formatCurrency(t.amount)}
                        </td>
                        <td className="py-2 px-2 text-right text-zinc-600 dark:text-zinc-400">
                          {quantityAtDate > 0 ? quantityAtDate : '-'}
                        </td>
                        <td className="py-2 px-2 text-right text-violet-600 dark:text-violet-400 font-medium">
                          {dividendPerShare > 0 ? `${dividendPerShare.toFixed(2)} €` : '-'}
                        </td>
                        <td className="py-2 px-2 text-right text-blue-600 dark:text-blue-400 font-medium hidden md:table-cell">
                          {yieldOnCost > 0 ? `${yieldOnCost.toFixed(2)}%` : '-'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
