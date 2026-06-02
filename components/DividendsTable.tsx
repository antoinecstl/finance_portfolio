'use client';

import { useMemo, useState } from 'react';
import { Transaction, StockPosition, StockQuote } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { calculatePositionsAtDate, findCalculatedPosition } from '@/lib/portfolio-calculator';
import { Coins, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { useSubscription } from '@/lib/subscription-client';
import { ProBlur } from './ProBlur';

interface DividendSummary {
  symbol: string;
  name: string;
  currency: string;
  totalDividends: number;
  dividendCount: number;
  lastDividendDate: string;
  lastDividendAmount: number;
  avgDividendPerShare?: number; // moyenne par action dans la devise du dividende
  avgYieldOnCost?: number; // Rdt/Coût moyen sur la période
}

interface DividendsTableProps {
  transactions: Transaction[];
  positions: StockPosition[];
  quotes: Record<string, StockQuote>;
}

function DividendSummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-2.5 sm:p-3">
      <div className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-base sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function txCurrency(tx: Transaction): string {
  return (tx.currency ?? 'EUR').toUpperCase();
}

function addCurrencyAmount(map: Map<string, number>, currency: string, amount: number) {
  map.set(currency, (map.get(currency) ?? 0) + amount);
}

function formatCurrencyMap(map: Map<string, number>): string {
  const entries = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return formatCurrency(0);
  return entries.map(([currency, amount]) => formatCurrency(amount, currency)).join(' + ');
}

export function DividendsTable({ transactions, positions }: DividendsTableProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const { hasFeature } = useSubscription();
  const isProUser = hasFeature('advanced_analytics');

  // Calculer les années disponibles et totaux par année
  const { dividendsByYear, years } = useMemo(() => {
    const byYear = new Map<number, Map<string, number>>();
    const yearsSet = new Set<number>();

    const dividendTransactions = transactions.filter(t => t.type === 'DIVIDEND');

    dividendTransactions.forEach(t => {
      const year = new Date(t.date).getFullYear();
      yearsSet.add(year);
      const yearTotals = byYear.get(year) ?? new Map<string, number>();
      addCurrencyAmount(yearTotals, txCurrency(t), t.amount);
      byYear.set(year, yearTotals);
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

    return {
      dividendsByYear: byYear,
      years: sortedYears,
    };
  }, [transactions]);

  // Calculer les statistiques des dividendes FILTRÉES par année
  const { dividendsByStock, totalDividendsByCurrency, dividendCountsByCurrency } = useMemo(() => {
    const byStock = new Map<string, DividendSummary>();
    const totalsByCurrency = new Map<string, number>();
    const countsByCurrency = new Map<string, number>();

    // Filtrer les transactions de type dividende ET par année si sélectionnée
    const dividendTransactions = transactions.filter(t => {
      if (t.type !== 'DIVIDEND') return false;
      if (selectedYear === 'all') return true;
      return new Date(t.date).getFullYear() === selectedYear;
    });

    dividendTransactions.forEach(t => {
      const symbol = t.stock_symbol?.toUpperCase() || 'NON_ATTRIBUE';
      const currency = txCurrency(t);
      const key = `${symbol}:${currency}`;

      // Par action
      const existing = byStock.get(key) || {
        symbol,
        name: symbol,
        currency,
        totalDividends: 0,
        dividendCount: 0,
        lastDividendDate: '',
        lastDividendAmount: 0,
      };

      existing.totalDividends += t.amount;
      existing.dividendCount += 1;
      addCurrencyAmount(totalsByCurrency, currency, t.amount);
      countsByCurrency.set(currency, (countsByCurrency.get(currency) ?? 0) + 1);
      
      if (t.date > existing.lastDividendDate) {
        existing.lastDividendDate = t.date;
        existing.lastDividendAmount = t.amount;
      }

      byStock.set(key, existing);
    });

    // Enrichir avec les noms et calculer les moyennes
    byStock.forEach((summary) => {
      const symbol = summary.symbol;
      const position = positions.find(p => p.symbol.toUpperCase() === symbol);
      if (position) {
        summary.name = position.name;
      }
      
      // Calculer les moyennes €/action et Rdt/Coût sur la période
      const symbolDividends = dividendTransactions.filter(t => 
        (t.stock_symbol?.toUpperCase() || 'NON_ATTRIBUE') === symbol
        && txCurrency(t) === summary.currency
      );
      
      let totalDividendPerShare = 0;
      let totalYieldOnCost = 0;
      let validCount = 0;
      
      symbolDividends.forEach(t => {
        if (t.stock_symbol) {
          const positionsAtDate = calculatePositionsAtDate(transactions, t.date);
          const posAtDate = findCalculatedPosition(
            positionsAtDate,
            t.stock_symbol.toUpperCase(),
            txCurrency(t)
          );
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

    return {
      dividendsByStock: Array.from(byStock.values()).sort((a, b) => b.totalDividends - a.totalDividends),
      totalDividendsByCurrency: totalsByCurrency,
      dividendCountsByCurrency: countsByCurrency,
    };
  }, [transactions, positions, selectedYear]);

  const averageDividendLabel = useMemo(() => {
    const averages = new Map<string, number>();
    dividendCountsByCurrency.forEach((count, currency) => {
      const total = totalDividendsByCurrency.get(currency) ?? 0;
      if (count > 0) averages.set(currency, total / count);
    });
    return formatCurrencyMap(averages);
  }, [dividendCountsByCurrency, totalDividendsByCurrency]);

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
            Ajoutez des transactions de type &quot;Dividende&quot; pour voir les statistiques
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-4">
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
          className="w-full sm:w-auto text-xs sm:text-sm px-2 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        >
          <option value="all">Toutes les années</option>
          {years.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Résumé global */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <DividendSummaryCard
          label="Total dividendes"
          value={formatCurrencyMap(totalDividendsByCurrency)}
        />
        <DividendSummaryCard
          label="Nb. versements"
          value={filteredTransactions.length}
        />
        <DividendSummaryCard
          label="Actions payeuses"
          value={new Set(dividendsByStock.filter(d => d.symbol !== 'NON_ATTRIBUE').map(d => d.symbol)).size}
        />
        <DividendSummaryCard
          label="Moyenne / versement"
          value={filteredTransactions.length > 0 ? averageDividendLabel : formatCurrency(0)}
        />
      </div>

      {/* Dividendes par année */}
      {years.length > 1 && selectedYear === 'all' && (
        <ProBlur feature="advanced_analytics" label="Évolution par année — Pro">
        <div className="mb-4 sm:mb-6">
          <h4 className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Évolution par année
          </h4>
          <div className="flex gap-2 flex-wrap">
            {years.map(year => {
              const amountsByCurrency = dividendsByYear.get(year) ?? new Map<string, number>();
              const displayAmount = formatCurrencyMap(amountsByCurrency);
              const amountForHeight = Array.from(amountsByCurrency.values()).reduce((sum, amount) => sum + amount, 0);
              const maxAmount = Math.max(
                ...Array.from(dividendsByYear.values()).map((totals) =>
                  Array.from(totals.values()).reduce((sum, amount) => sum + amount, 0)
                )
              );
              const percentage = maxAmount > 0 ? (amountForHeight / maxAmount) * 100 : 0;
              
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
                    {displayAmount}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </ProBlur>
      )}

      {/* Tableau par action - desktop/tablet */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="text-left py-2 px-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">Action</th>
              <th className="text-right py-2 px-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">Total reçu</th>
              <th className="text-right py-2 px-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">Versements</th>
              <th className="text-right py-2 px-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hidden md:table-cell">
                {isProUser ? 'Moy. /action' : <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400"><Lock className="h-3 w-3" />Moy. /action</span>}
              </th>
              <th className="text-right py-2 px-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hidden lg:table-cell">
                {isProUser ? 'Moy. Rdt/Coût' : <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400"><Lock className="h-3 w-3" />Moy. Rdt/Coût</span>}
              </th>
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
                    {formatCurrency(dividend.totalDividends, dividend.currency)}
                  </span>
                </td>
                <td className="py-3 px-2 text-right text-zinc-700 dark:text-zinc-300">
                  {dividend.dividendCount}
                </td>
                <td className="py-3 px-2 text-right hidden md:table-cell">
                  {dividend.avgDividendPerShare !== undefined ? (
                    <span className={`text-sm font-medium text-violet-600 dark:text-violet-400 ${isProUser ? '' : 'blur-sm select-none'}`}>
                      {formatCurrency(dividend.avgDividendPerShare, dividend.currency)}
                    </span>
                  ) : (
                    <span className="text-zinc-400">-</span>
                  )}
                </td>
                <td className="py-3 px-2 text-right hidden lg:table-cell">
                  {dividend.avgYieldOnCost !== undefined ? (
                    <span className={`text-sm font-medium text-blue-600 dark:text-blue-400 ${isProUser ? '' : 'blur-sm select-none'}`}>
                      {dividend.avgYieldOnCost.toFixed(2)}%
                    </span>
                  ) : (
                    <span className="text-zinc-400">-</span>
                  )}
                </td>
                <td className="py-3 px-2 text-right text-zinc-500 hidden xl:table-cell">
                  <div className="text-xs">{formatDate(dividend.lastDividendDate)}</div>
                  <div className="text-xs text-emerald-600">{formatCurrency(dividend.lastDividendAmount, dividend.currency)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Liste par action - mobile */}
      <div className="sm:hidden space-y-2">
        {dividendsByStock.map((dividend) => (
          <div key={dividend.symbol} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-900/40">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  {dividend.symbol === 'NON_ATTRIBUE' ? '(Non attribue)' : dividend.symbol}
                </div>
                <div className="text-xs text-zinc-500 truncate">
                  {dividend.symbol === 'NON_ATTRIBUE' ? 'Dividendes sans action' : dividend.name}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(dividend.totalDividends, dividend.currency)}
                </div>
                <div className="text-xs text-zinc-500">{dividend.dividendCount} versements</div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-zinc-500">Moy. /action: </span>
                <span className={`font-medium text-violet-600 dark:text-violet-400 ${isProUser ? '' : 'blur-sm select-none'}`}>
                  {dividend.avgDividendPerShare !== undefined ? formatCurrency(dividend.avgDividendPerShare, dividend.currency) : '-'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Rdt/Coût: </span>
                <span className={`font-medium text-blue-600 dark:text-blue-400 ${isProUser ? '' : 'blur-sm select-none'}`}>
                  {dividend.avgYieldOnCost !== undefined ? `${dividend.avgYieldOnCost.toFixed(2)}%` : '-'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Historique détaillé */}
      <div className="mt-4">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showDetails ? 'Masquer' : 'Voir'} l&apos;historique détaillé
        </button>
        
        {showDetails && (
          <div className="mt-3 max-h-64 overflow-y-auto">
            <table className="hidden sm:table w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-zinc-900">
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Date</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-zinc-500">Action</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-zinc-500">Montant</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-zinc-500">Qté</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-zinc-500">/action</th>
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
                      const position = findCalculatedPosition(positionsAtDate, symbol, txCurrency(t));
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
                          {formatCurrency(t.amount, txCurrency(t))}
                        </td>
                        <td className="py-2 px-2 text-right text-zinc-600 dark:text-zinc-400">
                          {quantityAtDate > 0 ? quantityAtDate : '-'}
                        </td>
                        <td className="py-2 px-2 text-right text-violet-600 dark:text-violet-400 font-medium">
                          {dividendPerShare > 0 ? formatCurrency(dividendPerShare, txCurrency(t)) : '-'}
                        </td>
                        <td className="py-2 px-2 text-right text-blue-600 dark:text-blue-400 font-medium hidden md:table-cell">
                          {yieldOnCost > 0 ? `${yieldOnCost.toFixed(2)}%` : '-'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>

            <div className="sm:hidden space-y-2">
              {filteredTransactions
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((t) => {
                  const symbol = t.stock_symbol?.toUpperCase();
                  let quantityAtDate = 0;
                  let dividendPerShare = 0;
                  let yieldOnCost = 0;

                  if (symbol) {
                    const positionsAtDate = calculatePositionsAtDate(transactions, t.date);
                    const position = findCalculatedPosition(positionsAtDate, symbol, txCurrency(t));
                    quantityAtDate = position?.quantity || 0;
                    const averagePrice = position?.averagePrice || 0;

                    if (quantityAtDate > 0) {
                      dividendPerShare = t.amount / quantityAtDate;
                      const costBasis = quantityAtDate * averagePrice;
                      if (costBasis > 0) {
                        yieldOnCost = (t.amount / costBasis) * 100;
                      }
                    }
                  }

                  return (
                    <div key={t.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-900/40">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-zinc-500">{formatDate(t.date)}</div>
                        <div className="font-semibold text-sm text-emerald-600">{formatCurrency(t.amount, txCurrency(t))}</div>
                      </div>
                      <div className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {t.stock_symbol || '(Non attribue)'}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-zinc-500">Qté: </span>
                          <span className="text-zinc-700 dark:text-zinc-300">{quantityAtDate > 0 ? quantityAtDate : '-'}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500">/action: </span>
                          <span className="text-violet-600 dark:text-violet-400">{dividendPerShare > 0 ? formatCurrency(dividendPerShare, txCurrency(t)) : '-'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-zinc-500">Rdt/Coût: </span>
                          <span className="text-blue-600 dark:text-blue-400">{yieldOnCost > 0 ? `${yieldOnCost.toFixed(2)}%` : '-'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
