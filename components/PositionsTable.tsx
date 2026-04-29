'use client';

import React, { useState, useMemo } from 'react';
import { StockPosition, StockQuote, Transaction } from '@/lib/types';
import { EnrichedAccount } from '@/lib/hooks';
import { accountSupportsPositions, formatCurrency, formatNumber, formatPercent } from '@/lib/utils';
import { Wallet, History, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';

// Type pour les positions clôturées (vendues)
interface ClosedPosition {
  key: string;
  symbol: string;
  name: string;
  accountId: string;
  accountName: string;
  accountType: string;
  totalBought: number;
  totalSold: number;
  avgBuyPrice: number;
  avgSellPrice: number;
  realizedGain: number;
  realizedGainPercent: number;
  lastSellDate: string;
}

interface PositionsTableProps {
  positions: StockPosition[];
  quotes: Record<string, StockQuote>;
  accounts?: EnrichedAccount[];
  transactions?: Transaction[];
  showCash?: boolean;
  showHistory?: boolean;
  groupByAccount?: boolean;
}

export function PositionsTable({
  positions,
  quotes,
  accounts = [],
  transactions = [],
  showCash = true,
  showHistory = true,
  groupByAccount = false,
}: PositionsTableProps) {
  const [showClosedPositions, setShowClosedPositions] = useState(false);

  // Comptes du scope pouvant détenir des positions.
  const stockAccounts = useMemo(() => {
    return accounts.filter(accountSupportsPositions);
  }, [accounts]);

  // Calculer le cash disponible sur les comptes PEA/CTO (utiliser calculatedCash si disponible)
  const cashBalance = useMemo(() => {
    return stockAccounts.reduce((sum, a) => sum + (a.calculatedCash ?? 0), 0);
  }, [stockAccounts]);

  const accountById = useMemo(() => {
    const map = new Map<string, EnrichedAccount>();
    accounts.forEach(a => map.set(a.id, a));
    return map;
  }, [accounts]);

  // Cash par compte (si on regroupe par compte) - sinon une seule ligne agrégée.
  const cashAccounts = useMemo(() => {
    return stockAccounts.filter(a => (a.calculatedCash ?? 0) > 0);
  }, [stockAccounts]);

  // Calculer les positions clôturées à partir des transactions
  // Une position fermée = des ventes ont eu lieu, et soit:
  // - Le symbole n'a plus de position ouverte (vendu totalement)
  // - OU il y a eu des cycles d'achat/vente complets dans le passé
  const closedPositions = useMemo(() => {
    // Grouper les transactions par compte+symbole pour ne pas mélanger les positions de comptes différents
    const positionHistory = new Map<string, {
      key: string;
      accountId: string;
      symbol: string;
      name: string;
      closedTrades: Array<{
        buyQty: number;
        buyTotal: number;
        sellQty: number;
        sellTotal: number;
        sellDate: string;
      }>;
    }>();

    // Trier les transactions par date pour suivre les cycles
    const sortedTransactions = [...transactions]
      .filter(t => t.stock_symbol && ['BUY', 'SELL'].includes(t.type))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Pour chaque (compte, symbole), calculer les positions vendues
    const runningPositions = new Map<string, { qty: number; totalCost: number }>();

    sortedTransactions.forEach(t => {
      const symbol = t.stock_symbol!.toUpperCase();
      const accountId = t.account_id;
      const key = `${accountId}:${symbol}`;
      const qty = t.quantity || 0;
      const amount = t.amount || 0;

      if (!positionHistory.has(key)) {
        positionHistory.set(key, { key, accountId, symbol, name: symbol, closedTrades: [] });
      }

      const running = runningPositions.get(key) || { qty: 0, totalCost: 0 };

      if (t.type === 'BUY') {
        running.qty += qty;
        running.totalCost += amount;
        runningPositions.set(key, running);
      } else if (t.type === 'SELL') {
        const avgBuyPrice = running.qty > 0 ? running.totalCost / running.qty : 0;
        const sellQty = Math.min(qty, running.qty);

        if (sellQty > 0) {
          positionHistory.get(key)!.closedTrades.push({
            buyQty: sellQty,
            buyTotal: sellQty * avgBuyPrice,
            sellQty: sellQty,
            sellTotal: amount,
            sellDate: t.date,
          });

          running.qty -= sellQty;
          running.totalCost -= sellQty * avgBuyPrice;
          runningPositions.set(key, running);
        }
      }
    });

    const closed: ClosedPosition[] = [];
    positionHistory.forEach((data) => {
      if (data.closedTrades.length > 0) {
        const totalBought = data.closedTrades.reduce((sum, t) => sum + t.buyQty, 0);
        const totalBuyAmount = data.closedTrades.reduce((sum, t) => sum + t.buyTotal, 0);
        const totalSold = data.closedTrades.reduce((sum, t) => sum + t.sellQty, 0);
        const totalSellAmount = data.closedTrades.reduce((sum, t) => sum + t.sellTotal, 0);
        const lastSellDate = data.closedTrades[data.closedTrades.length - 1].sellDate;

        const avgBuyPrice = totalBought > 0 ? totalBuyAmount / totalBought : 0;
        const avgSellPrice = totalSold > 0 ? totalSellAmount / totalSold : 0;
        const realizedGain = totalSellAmount - totalBuyAmount;
        const realizedGainPercent = totalBuyAmount > 0 ? (realizedGain / totalBuyAmount) * 100 : 0;

        const account = accountById.get(data.accountId);
        closed.push({
          key: data.key,
          symbol: data.symbol,
          name: data.name,
          accountId: data.accountId,
          accountName: account?.name ?? '—',
          accountType: account?.type ?? '',
          totalBought,
          totalSold,
          avgBuyPrice,
          avgSellPrice,
          realizedGain,
          realizedGainPercent,
          lastSellDate,
        });
      }
    });

    return closed.sort((a, b) => b.lastSellDate.localeCompare(a.lastSellDate));
  }, [transactions, accountById]);

  // Calculer les totaux
  let totalValue = 0;
  positions.forEach((position) => {
    const currentPrice = quotes[position.symbol]?.price ?? position.average_price;
    totalValue += position.quantity * currentPrice;
  });

  // Total avec cash
  const totalWithCash = totalValue + (showCash ? cashBalance : 0);

  // Total des gains réalisés
  const totalRealizedGain = closedPositions.reduce((sum, p) => sum + p.realizedGain, 0);

  if (positions.length === 0 && closedPositions.length === 0 && cashBalance === 0) {
    return (
      <div className="text-center py-8 sm:py-12 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <BarChart2 className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-zinc-400" />
        <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Aucune position
        </h3>
        <p className="mt-1 sm:mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Ajoutez des actions à votre portefeuille
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Cash disponible */}
      {showCash && cashBalance > 0 && (
        groupByAccount && cashAccounts.length > 1 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {cashAccounts.map((acc) => {
              const accStocksValue = positions
                .filter(p => p.account_id === acc.id)
                .reduce((sum, p) => sum + p.quantity * (quotes[p.symbol]?.price ?? p.average_price), 0);
              return (
                <div key={acc.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide mb-2">
                    {acc.name} <span className="text-[10px] opacity-70">({acc.type})</span>
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-1.5 sm:p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                        <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">Liquidités</p>
                        <p className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(acc.calculatedCash ?? 0)}
                        </p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right pl-8 sm:pl-0">
                      <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">Total compte</p>
                      <p className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                        {formatCurrency((acc.calculatedCash ?? 0) + accStocksValue)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">Liquidités</p>
                  <p className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(cashBalance)}
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right pl-8 sm:pl-0">
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">Total portefeuille</p>
                <p className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(totalWithCash)}
                </p>
              </div>
            </div>
          </div>
        )
      )}

      {/* Positions clôturées (historique) */}
      {showHistory && closedPositions.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <button
            onClick={() => setShowClosedPositions(!showClosedPositions)}
            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Positions clôturées</span>
              <span className="sm:hidden">Clôturées</span>
              <span className="text-xs sm:text-sm">({closedPositions.length})</span>
              <span className={`text-xs sm:text-sm font-normal ${totalRealizedGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                ({formatCurrency(totalRealizedGain)})
              </span>
            </h3>
            {showClosedPositions ? (
              <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
            ) : (
              <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
            )}
          </button>
          
          {showClosedPositions && (() => {
            // Construire les groupes pour le rendu
            const groups: Array<{ accountId: string | null; accountName: string; accountType: string; items: ClosedPosition[] }> = [];
            if (groupByAccount) {
              const byAcc = new Map<string, ClosedPosition[]>();
              closedPositions.forEach(p => {
                const arr = byAcc.get(p.accountId) ?? [];
                arr.push(p);
                byAcc.set(p.accountId, arr);
              });
              byAcc.forEach((items, accId) => {
                groups.push({ accountId: accId, accountName: items[0].accountName, accountType: items[0].accountType, items });
              });
            } else {
              groups.push({ accountId: null, accountName: '', accountType: '', items: closedPositions });
            }
            const uniqueAccountIds = new Set(closedPositions.map(p => p.accountId));
            const showAccountCol = !groupByAccount && uniqueAccountIds.size > 1;
            const colSpan = showAccountCol ? 7 : 6;

            return (
              <>
                {/* Version mobile: cartes */}
                <div className="sm:hidden">
                  {groups.map((group) => (
                    <div key={`grp-m-${group.accountId ?? 'all'}`}>
                      {group.accountId && (
                        <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                            {group.accountName} <span className="text-[10px] opacity-70">({group.accountType})</span>
                          </p>
                        </div>
                      )}
                      {group.items.map((pos) => (
                        <div key={pos.key} className="border-b border-zinc-100 dark:border-zinc-800 p-3 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-zinc-900 dark:text-zinc-100">{pos.symbol}</p>
                              <p className="text-xs text-zinc-500">{formatNumber(pos.totalSold, 0)} vendus</p>
                              {showAccountCol && (
                                <p className="text-[10px] text-zinc-500 mt-0.5">
                                  {pos.accountName} <span className="opacity-70">({pos.accountType})</span>
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className={`font-semibold ${pos.realizedGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatCurrency(pos.realizedGain)}
                              </p>
                              <p className={`text-xs ${pos.realizedGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatPercent(pos.realizedGainPercent)}
                              </p>
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-zinc-500">
                            <span>Achat: {formatCurrency(pos.avgBuyPrice)} → Vente: {formatCurrency(pos.avgSellPrice)}</span>
                            <span>{new Date(pos.lastSellDate).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Version desktop: tableau */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-left">
                        <th className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                          Action
                        </th>
                        {showAccountCol && (
                          <th className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                            Compte
                          </th>
                        )}
                        <th className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                          Qté vendue
                        </th>
                        <th className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                          Prix achat
                        </th>
                        <th className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                          Prix vente
                        </th>
                        <th className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                          Dernière vente
                        </th>
                        <th className="py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                          +/- Value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((group) => (
                        <React.Fragment key={`grp-d-${group.accountId ?? 'all'}`}>
                          {group.accountId && (
                            <tr className="bg-zinc-100 dark:bg-zinc-800/70">
                              <td colSpan={colSpan} className="py-2 px-3 sm:px-4">
                                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                                  {group.accountName} <span className="text-[10px] opacity-70">({group.accountType})</span>
                                </span>
                              </td>
                            </tr>
                          )}
                          {group.items.map((pos) => (
                            <tr key={pos.key} className="border-b border-zinc-100 dark:border-zinc-800">
                              <td className="py-2 sm:py-3 px-3 sm:px-4">
                                <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{pos.symbol}</p>
                              </td>
                              {showAccountCol && (
                                <td className="py-2 sm:py-3 px-3 sm:px-4">
                                  <div className="text-xs">
                                    <p className="font-medium text-zinc-700 dark:text-zinc-300">{pos.accountName}</p>
                                    <p className="text-[10px] text-zinc-500">{pos.accountType}</p>
                                  </div>
                                </td>
                              )}
                              <td className="py-2 sm:py-3 px-3 sm:px-4 text-right text-sm text-zinc-900 dark:text-zinc-100">
                                {formatNumber(pos.totalSold, 0)}
                              </td>
                              <td className="py-2 sm:py-3 px-3 sm:px-4 text-right text-sm text-zinc-900 dark:text-zinc-100">
                                {formatCurrency(pos.avgBuyPrice)}
                              </td>
                              <td className="py-2 sm:py-3 px-3 sm:px-4 text-right text-sm text-zinc-900 dark:text-zinc-100">
                                {formatCurrency(pos.avgSellPrice)}
                              </td>
                              <td className="py-2 sm:py-3 px-3 sm:px-4 text-right text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                                {new Date(pos.lastSellDate).toLocaleDateString('fr-FR')}
                              </td>
                              <td className={`py-2 sm:py-3 px-3 sm:px-4 text-right font-semibold text-sm ${
                                pos.realizedGain >= 0 ? 'text-emerald-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(pos.realizedGain)}
                                <span className="text-xs font-normal ml-1">
                                  ({formatPercent(pos.realizedGainPercent)})
                                </span>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
