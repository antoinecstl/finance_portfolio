'use client';

import { useState, useMemo } from 'react';
import { StockPosition, StockQuote, Transaction } from '@/lib/types';
import { EnrichedAccount } from '@/lib/hooks';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils';
import { TrendingUp, TrendingDown, BarChart2, Wallet, History, ChevronDown, ChevronUp } from 'lucide-react';

interface PositionRowProps {
  position: StockPosition;
  quote?: StockQuote;
}

function PositionRow({ position, quote }: PositionRowProps) {
  const currentPrice = quote?.price || position.current_price;
  const dayChange = quote?.change || 0;
  const dayChangePercent = quote?.changePercent || 0;
  
  const positionValue = position.quantity * currentPrice;
  const positionCost = position.quantity * position.average_price;
  const totalGain = positionValue - positionCost;
  const totalGainPercent = positionCost > 0 ? (totalGain / positionCost) * 100 : 0;
  
  const isPositiveDay = dayChange >= 0;
  const isPositiveTotal = totalGain >= 0;

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      <td className="py-4 px-4">
        <div>
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">
            {position.symbol}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate max-w-[150px]">
            {position.name}
          </p>
        </div>
      </td>
      <td className="py-4 px-4 text-right">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">
          {formatNumber(position.quantity, position.quantity % 1 === 0 ? 0 : 4)}
        </p>
      </td>
      <td className="py-4 px-4 text-right">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">
          {formatCurrency(position.average_price)}
        </p>
      </td>
      <td className="py-4 px-4 text-right">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">
          {formatCurrency(currentPrice)}
        </p>
        <div className={`flex items-center justify-end gap-1 text-sm ${
          isPositiveDay ? 'text-emerald-600' : 'text-red-600'
        }`}>
          {isPositiveDay ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {formatPercent(dayChangePercent)}
        </div>
      </td>
      <td className="py-4 px-4 text-right">
        <p className="font-bold text-zinc-900 dark:text-zinc-100">
          {formatCurrency(positionValue)}
        </p>
      </td>
      <td className="py-4 px-4 text-right">
        <p className={`font-semibold ${isPositiveTotal ? 'text-emerald-600' : 'text-red-600'}`}>
          {formatCurrency(totalGain)}
        </p>
        <p className={`text-sm ${isPositiveTotal ? 'text-emerald-600' : 'text-red-600'}`}>
          {formatPercent(totalGainPercent)}
        </p>
      </td>
    </tr>
  );
}

// Type pour les positions clôturées (vendues)
interface ClosedPosition {
  symbol: string;
  name: string;
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
}

export function PositionsTable({ 
  positions, 
  quotes, 
  accounts = [],
  transactions = [],
  showCash = true,
  showHistory = true
}: PositionsTableProps) {
  const [showClosedPositions, setShowClosedPositions] = useState(false);

  // Calculer le cash disponible sur les comptes PEA/CTO (utiliser calculatedCash si disponible)
  const cashBalance = useMemo(() => {
    return accounts
      .filter(a => ['PEA', 'CTO'].includes(a.type))
      .reduce((sum, a) => sum + (a.calculatedCash ?? a.balance), 0);
  }, [accounts]);

  // Calculer les positions clôturées à partir des transactions
  const closedPositions = useMemo(() => {
    const positionMap = new Map<string, {
      symbol: string;
      name: string;
      buyQty: number;
      buyTotal: number;
      sellQty: number;
      sellTotal: number;
      lastSellDate: string;
    }>();

    // Grouper les transactions par symbole
    transactions
      .filter(t => t.stock_symbol && ['BUY', 'SELL'].includes(t.type))
      .forEach(t => {
        const symbol = t.stock_symbol!.toUpperCase();
        const existing = positionMap.get(symbol) || {
          symbol,
          name: symbol,
          buyQty: 0,
          buyTotal: 0,
          sellQty: 0,
          sellTotal: 0,
          lastSellDate: '',
        };

        if (t.type === 'BUY') {
          existing.buyQty += t.quantity || 0;
          existing.buyTotal += t.amount || 0;
        } else if (t.type === 'SELL') {
          existing.sellQty += t.quantity || 0;
          existing.sellTotal += t.amount || 0;
          if (t.date > existing.lastSellDate) {
            existing.lastSellDate = t.date;
          }
        }

        positionMap.set(symbol, existing);
      });

    // Filtrer les positions qui ont été vendues et qui ne sont plus ouvertes
    const openSymbols = new Set(positions.map(p => p.symbol.toUpperCase()));
    
    const closed: ClosedPosition[] = [];
    positionMap.forEach((data) => {
      // Une position est clôturée si elle a été vendue et n'est plus dans les positions ouvertes
      if (data.sellQty > 0 && !openSymbols.has(data.symbol)) {
        const avgBuyPrice = data.buyQty > 0 ? data.buyTotal / data.buyQty : 0;
        const avgSellPrice = data.sellQty > 0 ? data.sellTotal / data.sellQty : 0;
        const realizedGain = data.sellTotal - (data.sellQty * avgBuyPrice);
        const realizedGainPercent = data.buyTotal > 0 ? (realizedGain / (data.sellQty * avgBuyPrice)) * 100 : 0;

        closed.push({
          symbol: data.symbol,
          name: data.name,
          totalBought: data.buyQty,
          totalSold: data.sellQty,
          avgBuyPrice,
          avgSellPrice,
          realizedGain,
          realizedGainPercent,
          lastSellDate: data.lastSellDate,
        });
      }
    });

    return closed.sort((a, b) => b.lastSellDate.localeCompare(a.lastSellDate));
  }, [transactions, positions]);

  // Calculer les totaux
  let totalValue = 0;
  let totalCost = 0;
  positions.forEach((position) => {
    const currentPrice = quotes[position.symbol]?.price || position.current_price;
    totalValue += position.quantity * currentPrice;
    totalCost += position.quantity * position.average_price;
  });
  const totalGain = totalValue - totalCost;
  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  // Total avec cash
  const totalWithCash = totalValue + (showCash ? cashBalance : 0);

  // Total des gains réalisés
  const totalRealizedGain = closedPositions.reduce((sum, p) => sum + p.realizedGain, 0);

  if (positions.length === 0 && closedPositions.length === 0 && cashBalance === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <BarChart2 className="mx-auto h-12 w-12 text-zinc-400" />
        <h3 className="mt-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Aucune position
        </h3>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Ajoutez des actions à votre portefeuille
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cash disponible */}
      {showCash && cashBalance > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Wallet className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Liquidités PEA/CTO</p>
                <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(cashBalance)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Total portefeuille</p>
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {formatCurrency(totalWithCash)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Positions ouvertes */}
      {positions.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              Positions ouvertes
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-left">
                  <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                    Action
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                    Quantité
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                    PRU
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                    Cours
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                    Valorisation
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                    +/- Value latente
                  </th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
                  <PositionRow
                    key={position.id}
                    position={position}
                    quote={quotes[position.symbol]}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 font-semibold">
                  <td colSpan={4} className="py-4 px-4 text-zinc-900 dark:text-zinc-100">
                    Total positions
                  </td>
                  <td className="py-4 px-4 text-right text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(totalValue)}
                  </td>
                  <td className={`py-4 px-4 text-right ${
                    totalGain >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(totalGain)} ({formatPercent(totalGainPercent)})
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Positions clôturées (historique) */}
      {showHistory && closedPositions.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <button
            onClick={() => setShowClosedPositions(!showClosedPositions)}
            className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <History className="h-4 w-4" />
              Positions clôturées ({closedPositions.length})
              <span className={`text-sm font-normal ${totalRealizedGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                ({formatCurrency(totalRealizedGain)} réalisé)
              </span>
            </h3>
            {showClosedPositions ? (
              <ChevronUp className="h-5 w-5 text-zinc-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-zinc-400" />
            )}
          </button>
          
          {showClosedPositions && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-left">
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                      Action
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                      Qté vendue
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                      Prix achat moy.
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                      Prix vente moy.
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                      Dernière vente
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">
                      +/- Value réalisée
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {closedPositions.map((pos) => (
                    <tr key={pos.symbol} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-3 px-4">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{pos.symbol}</p>
                      </td>
                      <td className="py-3 px-4 text-right text-zinc-900 dark:text-zinc-100">
                        {formatNumber(pos.totalSold, 0)}
                      </td>
                      <td className="py-3 px-4 text-right text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(pos.avgBuyPrice)}
                      </td>
                      <td className="py-3 px-4 text-right text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(pos.avgSellPrice)}
                      </td>
                      <td className="py-3 px-4 text-right text-zinc-500 dark:text-zinc-400">
                        {new Date(pos.lastSellDate).toLocaleDateString('fr-FR')}
                      </td>
                      <td className={`py-3 px-4 text-right font-semibold ${
                        pos.realizedGain >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(pos.realizedGain)}
                        <span className="text-sm font-normal ml-1">
                          ({formatPercent(pos.realizedGainPercent)})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
