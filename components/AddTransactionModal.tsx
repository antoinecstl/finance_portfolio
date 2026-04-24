'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search } from 'lucide-react';
import { Account, StockPosition, Transaction } from '@/lib/types';
import { useStockSearch } from '@/lib/hooks';
import { useLimitReached } from './LimitReachedModal';
import { POPULAR_FRENCH_STOCKS } from '@/lib/stock-api';
import { calculatePositionsAtDate } from '@/lib/portfolio-calculator';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  accounts: Account[];
  positions: StockPosition[];
  transactions: Transaction[];
  defaultAccountId?: string;
}

const transactionTypes = [
  { value: 'DEPOSIT', label: 'Dépôt' },
  { value: 'WITHDRAWAL', label: 'Retrait' },
  { value: 'BUY', label: 'Achat d\'action' },
  { value: 'SELL', label: 'Vente d\'action' },
  { value: 'DIVIDEND', label: 'Dividende' },
  { value: 'INTEREST', label: 'Intérêts' },
  { value: 'FEE', label: 'Frais' },
];

const todayISO = () => new Date().toISOString().split('T')[0];

export function AddTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  accounts,
  positions,
  transactions,
  defaultAccountId,
}: AddTransactionModalProps) {
  const [accountId, setAccountId] = useState(defaultAccountId || '');
  const [type, setType] = useState('DEPOSIT');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [stockSymbol, setStockSymbol] = useState('');
  const [stockName, setStockName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [fees, setFees] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { results: searchResults, search } = useStockSearch();
  const limitReached = useLimitReached();

  const resetForm = () => {
    setAccountId(defaultAccountId || '');
    setType('DEPOSIT');
    setAmount('');
    setDescription('');
    setDate(todayISO());
    setStockSymbol('');
    setStockName('');
    setQuantity('');
    setPricePerUnit('');
    setFees('');
    setSearchQuery('');
    setShowSearchDropdown(false);
    setError(null);
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  // Calculer automatiquement le montant total
  useEffect(() => {
    if (quantity && pricePerUnit) {
      const total = parseFloat(quantity) * parseFloat(pricePerUnit);
      setAmount(total.toFixed(2));
    }
  }, [quantity, pricePerUnit]);

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Recherche d'actions
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timer = setTimeout(() => search(searchQuery), 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, search]);

  // Escape pour fermer + scroll-lock du body tant que le modal est ouvert
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        resetForm();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, loading]);

  // Positions dérivées du state parent (source de vérité unique).
  // Pour les ventes : positions du compte sélectionné uniquement.
  // Pour les dividendes : toutes les positions de l'utilisateur, dédupliquées par symbole.
  const sellablePositions = useMemo(
    () => positions.filter(p => p.account_id === accountId && p.quantity > 0),
    [positions, accountId]
  );

  const dividendPositions = useMemo(() => {
    const seen = new Map<string, StockPosition>();
    for (const p of positions) {
      const key = p.symbol.toUpperCase();
      if (!seen.has(key)) seen.set(key, p);
    }
    return Array.from(seen.values());
  }, [positions]);

  if (!isOpen) return null;

  const isStockTransaction = ['BUY', 'SELL'].includes(type);
  const isDividendTransaction = type === 'DIVIDEND';

  const handleSelectStock = (symbol: string, name: string) => {
    setStockSymbol(symbol);
    setStockName(name);
    setSearchQuery('');
    setShowSearchDropdown(false);
  };

  const handleSelectExistingPosition = (position: StockPosition) => {
    setStockSymbol(position.symbol);
    setStockName(position.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!accountId) {
        throw new Error('Veuillez sélectionner un compte');
      }

      const qty = parseFloat(quantity) || 0;
      const price = parseFloat(pricePerUnit) || 0;
      const totalAmount = parseFloat(amount) || 0;
      const feesAmount = Math.max(0, parseFloat(fees) || 0);

      // Validation côté client (UX feedback rapide). Le serveur re-valide.
      if (isStockTransaction) {
        if (!stockSymbol) throw new Error('Veuillez sélectionner une action');
        if (qty <= 0) throw new Error('La quantité doit être supérieure à 0');
        if (price <= 0) throw new Error('Le prix unitaire doit être supérieur à 0');
      }

      if (isDividendTransaction && !stockSymbol) {
        throw new Error('Veuillez sélectionner l\'action associée au dividende');
      }

      // Pré-validation locale pour SELL : on rejette tôt si la position est insuffisante
      // à la date choisie sur ce compte. Le serveur re-vérifie de toute façon.
      if (type === 'SELL') {
        const positionsAtDate = calculatePositionsAtDate(transactions, date, accountId);
        const positionAtDate = positionsAtDate.get(stockSymbol.toUpperCase());
        if (!positionAtDate || positionAtDate.quantity < qty) {
          throw new Error(
            `Position insuffisante sur ce compte au ${date}. Vous aviez ${positionAtDate?.quantity || 0} titres.`
          );
        }
      }

      const payload: {
        account_id: string;
        type: string;
        amount: number;
        fees: number;
        description: string;
        date: string;
        stock_symbol?: string;
        quantity?: number;
        price_per_unit?: number;
      } = {
        account_id: accountId,
        type,
        amount: totalAmount,
        fees: feesAmount,
        description:
          description ||
          (isStockTransaction
            ? `${type === 'BUY' ? 'Achat' : 'Vente'} ${qty} x ${stockSymbol}`
            : isDividendTransaction && stockSymbol
              ? `Dividende ${stockSymbol}`
              : ''),
        date,
      };

      if (isStockTransaction) {
        payload.stock_symbol = stockSymbol.toUpperCase();
        payload.quantity = qty;
        payload.price_per_unit = price;
      }

      if (isDividendTransaction && stockSymbol) {
        payload.stock_symbol = stockSymbol.toUpperCase();
      }

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 402) {
        const data = await res.json().catch(() => ({}));
        limitReached.show({
          scope: 'transactions',
          current: data.current,
          max: data.limit,
          reason: 'blocked',
        });
        throw new Error(data.message ?? 'Limite atteinte');
      }

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.reason ?? 'État du compte invalide après cette transaction.');
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Erreur lors de la création');
      }

      const txPayload = await res.json().catch(() => ({}));

      resetForm();
      await onSuccess();
      onClose();

      if (txPayload.at_cap) {
        limitReached.show({
          scope: 'transactions',
          current: txPayload.current,
          max: txPayload.limit,
          reason: 'reached',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-tx-title"
        className="relative flex flex-col bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg mx-0 sm:mx-4 max-h-[92vh] sm:max-h-[88vh] overflow-hidden"
      >
        {/* Drag handle : affordance bottom-sheet sur mobile */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" aria-hidden="true" />
        </div>

        {/* Header sticky : titre + close, pas d'absolute (pas de chevauchement) */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-2 sm:pt-5 pb-3 sm:pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 id="add-tx-title" className="text-base sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 pr-2">
            Ajouter une transaction
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer"
            className="shrink-0 p-1.5 -mr-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          id="add-tx-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-3 sm:space-y-4"
        >
          <div>
            <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Compte
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Sélectionner un compte</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {transactionTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {isDividendTransaction && dividendPositions.length > 0 && (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Action concernée
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-40 sm:max-h-48 overflow-y-auto pr-1">
                {dividendPositions.map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => handleSelectExistingPosition(pos)}
                    className={`text-left p-2 rounded-lg border text-xs sm:text-sm transition-colors min-w-0 ${
                      stockSymbol.toUpperCase() === pos.symbol.toUpperCase()
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                        : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{pos.symbol}</div>
                    <div className="text-xs text-zinc-500 truncate">{pos.name}</div>
                  </button>
                ))}
              </div>
              {stockSymbol && (
                <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex-1 min-w-0 text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 truncate">
                      Dividende pour <span className="font-semibold">{stockSymbol}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setStockSymbol(''); setStockName(''); }}
                      aria-label="Retirer la sélection"
                      className="shrink-0 p-1 rounded text-emerald-500 hover:text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isStockTransaction && (
            <>
              {type === 'SELL' && sellablePositions.length > 0 && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Position à vendre
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 sm:max-h-48 overflow-y-auto pr-1">
                    {sellablePositions.map((pos) => (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() => handleSelectExistingPosition(pos)}
                        className={`text-left p-2 rounded-lg border text-xs sm:text-sm transition-colors min-w-0 ${
                          stockSymbol.toUpperCase() === pos.symbol.toUpperCase()
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{pos.symbol}</div>
                        <div className="text-xs text-zinc-500 truncate">{pos.quantity} titres</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {type === 'BUY' && (
                <div className="relative" ref={searchRef}>
                  <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Rechercher une action
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowSearchDropdown(true);
                      }}
                      onFocus={() => setShowSearchDropdown(true)}
                      placeholder="Rechercher..."
                      className="w-full pl-10 pr-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {showSearchDropdown && searchResults.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 max-h-48 overflow-y-auto overscroll-contain">
                      {searchResults.map((result) => (
                        <button
                          key={result.symbol}
                          type="button"
                          onClick={() => handleSelectStock(result.symbol, result.name)}
                          className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 border-b border-zinc-100 dark:border-zinc-700 last:border-0"
                        >
                          <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{result.symbol}</div>
                          <div className="text-xs text-zinc-500 truncate">{result.name}</div>
                        </button>
                      ))}
                    </div>
                  )}

                  {!searchQuery && (
                    <div className="mt-2">
                      <div className="text-xs text-zinc-500 mb-1">Actions populaires :</div>
                      <div className="flex flex-wrap gap-1">
                        {POPULAR_FRENCH_STOCKS.slice(0, 6).map((stock) => (
                          <button
                            key={stock.symbol}
                            type="button"
                            onClick={() => handleSelectStock(stock.symbol, stock.name)}
                            className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                          >
                            {stock.symbol.replace('.PA', '')}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {stockSymbol && (
                <div className="p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-blue-900 dark:text-blue-100 truncate">{stockSymbol}</div>
                      <div className="text-xs text-blue-700 dark:text-blue-300 truncate">{stockName}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setStockSymbol(''); setStockName(''); }}
                      aria-label="Retirer la sélection"
                      className="shrink-0 p-1 rounded text-blue-500 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Quantité
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required={isStockTransaction}
                    className="w-full px-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Prix unitaire (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
                    required={isStockTransaction}
                    className="w-full px-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Montant (€) {isStockTransaction && <span className="text-zinc-400 text-xs">(auto)</span>}
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              readOnly={isStockTransaction}
              className={`w-full px-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isStockTransaction ? 'bg-zinc-50 dark:bg-zinc-900' : ''}`}
            />
          </div>

          {type !== 'FEE' && (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Frais (€) <span className="text-zinc-400 text-xs">optionnel</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {type === 'BUY' || type === 'WITHDRAWAL'
                  ? 'Débités en plus du montant.'
                  : 'Retenus sur le montant encaissé.'}
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Virement mensuel"
              className="w-full px-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div role="alert" className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-3 py-2 text-xs sm:text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </form>

        {/* Footer sticky : boutons toujours visibles, safe-area iOS */}
        <div className="shrink-0 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-3 sm:px-4 py-2.5 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="add-tx-form"
            disabled={loading}
            className="flex-1 px-3 sm:px-4 py-2.5 text-sm sm:text-base font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}
