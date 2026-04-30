'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search } from 'lucide-react';
import { Account, Transaction, TransactionType } from '@/lib/types';
import { useStockSearch } from '@/lib/hooks';
import { POPULAR_FRENCH_STOCKS, POPULAR_CRYPTOS } from '@/lib/stock-api';
import { calculatePositionsAtDate } from '@/lib/portfolio-calculator';
import {
  accountSupportsPositions,
  accountTypeAllowsAsset,
  assetAccountMismatchMessage,
  isCryptoSymbol,
} from '@/lib/utils';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  accounts: Account[];
  transactions: Transaction[];
  // La transaction à éditer. La modal s'ouvre quand cette prop est non-null
  // (ainsi que isOpen). Le compte d'origine n'est PAS modifiable côté
  // serveur : on l'affiche en lecture seule.
  transaction: Transaction | null;
}

const transactionTypes: Array<{ value: TransactionType; label: string }> = [
  { value: 'DEPOSIT', label: 'Dépôt' },
  { value: 'WITHDRAWAL', label: 'Retrait' },
  { value: 'BUY', label: 'Achat d\'action' },
  { value: 'SELL', label: 'Vente d\'action' },
  { value: 'DIVIDEND', label: 'Dividende' },
  { value: 'INTEREST', label: 'Intérêts' },
  { value: 'FEE', label: 'Frais' },
];

export function EditTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  accounts,
  transactions,
  transaction,
}: EditTransactionModalProps) {
  const [type, setType] = useState<TransactionType>('DEPOSIT');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
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

  // Frais existants : déduits du child FEE de la transaction parente.
  // Source de vérité unique = le tableau `transactions` (le parent).
  const linkedFee = useMemo(() => {
    if (!transaction?.fee_transaction_id) return null;
    return transactions.find((t) => t.id === transaction.fee_transaction_id) ?? null;
  }, [transaction, transactions]);

  const accountId = transaction?.account_id ?? '';
  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId]
  );

  const isStockTransaction = type === 'BUY' || type === 'SELL';
  const isDividendTransaction = type === 'DIVIDEND';

  // Pré-remplit le formulaire à chaque ouverture / changement de cible.
  useEffect(() => {
    if (!isOpen || !transaction) return;
    setType(transaction.type);
    setAmount(transaction.amount.toString());
    setDescription(transaction.description ?? '');
    setDate(transaction.date);
    setStockSymbol(transaction.stock_symbol ?? '');
    setStockName('');
    setQuantity(transaction.quantity != null ? transaction.quantity.toString() : '');
    setPricePerUnit(
      transaction.price_per_unit != null ? transaction.price_per_unit.toString() : ''
    );
    setFees(linkedFee ? linkedFee.amount.toString() : '');
    setSearchQuery('');
    setShowSearchDropdown(false);
    setError(null);
  }, [isOpen, transaction, linkedFee]);

  // Auto-calcul du montant pour BUY/SELL quand quantité ou prix changent.
  useEffect(() => {
    if (!isStockTransaction) return;
    if (quantity && pricePerUnit) {
      const total = parseFloat(quantity) * parseFloat(pricePerUnit);
      if (Number.isFinite(total)) setAmount(total.toFixed(2));
    }
  }, [quantity, pricePerUnit, isStockTransaction]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timer = setTimeout(() => search(searchQuery), 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, search]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
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
  }, [isOpen, loading, onClose]);

  // Positions vendables sur le compte à la date — pour pré-validation SELL.
  // On retire l'effet de la transaction en cours d'édition pour ne pas la
  // contraindre par elle-même (sinon éditer une vente serait impossible).
  const projectedTransactionsExcludingSelf = useMemo(() => {
    if (!transaction) return transactions;
    const excludeIds = new Set<string>([transaction.id]);
    if (transaction.fee_transaction_id) excludeIds.add(transaction.fee_transaction_id);
    return transactions.filter((t) => !excludeIds.has(t.id));
  }, [transactions, transaction]);

  if (!isOpen || !transaction) return null;

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleSelectStock = (symbol: string, name: string) => {
    setStockSymbol(symbol);
    setStockName(name);
    setSearchQuery('');
    setShowSearchDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!selectedAccount) {
        throw new Error('Compte introuvable');
      }
      const requiresPositionAccount = isStockTransaction || isDividendTransaction;
      if (requiresPositionAccount && !accountSupportsPositions(selectedAccount)) {
        throw new Error(
          'Ce type de transaction doit être rattaché à un compte pouvant détenir des positions. Supprimez la transaction et recréez-la sur le bon compte.'
        );
      }
      if (stockSymbol && !accountTypeAllowsAsset(selectedAccount.type, stockSymbol)) {
        throw new Error(assetAccountMismatchMessage(selectedAccount.type));
      }

      const qty = parseFloat(quantity) || 0;
      const price = parseFloat(pricePerUnit) || 0;
      const totalAmount = parseFloat(amount) || 0;
      const feesAmount = Math.max(0, parseFloat(fees) || 0);

      if (isStockTransaction) {
        if (!stockSymbol) throw new Error('Veuillez sélectionner une action');
        if (qty <= 0) throw new Error('La quantité doit être supérieure à 0');
        if (price <= 0) throw new Error('Le prix unitaire doit être supérieur à 0');
      }
      if (isDividendTransaction && !stockSymbol) {
        throw new Error('Veuillez sélectionner l\'action associée au dividende');
      }
      if (totalAmount <= 0) throw new Error('Le montant doit être supérieur à 0');
      if (type === 'FEE' && feesAmount > 0) {
        throw new Error('Une transaction de type Frais ne peut pas porter elle-même des frais.');
      }

      // Pré-validation locale SELL : la position doit suffire à la date,
      // hors contribution de la transaction elle-même.
      if (type === 'SELL') {
        const positionsAtDate = calculatePositionsAtDate(
          projectedTransactionsExcludingSelf,
          date,
          accountId
        );
        const positionAtDate = positionsAtDate.get(stockSymbol.toUpperCase());
        if (!positionAtDate || positionAtDate.quantity < qty) {
          throw new Error(
            `Position insuffisante sur ce compte au ${date}. Vous aviez ${positionAtDate?.quantity ?? 0} titres avant cette transaction.`
          );
        }
      }

      const payload: {
        type: TransactionType;
        amount: number;
        fees: number;
        description: string;
        date: string;
        stock_symbol?: string;
        quantity?: number;
        price_per_unit?: number;
      } = {
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

      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.reason ?? data.message ?? 'Cette modification rendrait la séquence du compte invalide.'
        );
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? data.error ?? 'Erreur lors de la modification');
      }

      await onSuccess();
      onClose();
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
        aria-labelledby="edit-tx-title"
        className="relative flex flex-col bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg mx-0 sm:mx-4 max-h-[92vh] sm:max-h-[88vh] overflow-hidden"
      >
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" aria-hidden="true" />
        </div>

        <div className="flex items-center justify-between px-4 sm:px-6 pt-2 sm:pt-5 pb-3 sm:pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 id="edit-tx-title" className="text-base sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 pr-2">
            Modifier la transaction
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
          id="edit-tx-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-3 sm:space-y-4"
        >
          {/* Compte en lecture seule : non modifiable côté serveur. */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Compte
            </label>
            <div className="w-full px-3 py-2 text-sm sm:text-base border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300">
              {selectedAccount?.name ?? 'Compte introuvable'}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              Le compte n&apos;est pas modifiable. Pour déplacer une transaction, supprimez-la et recréez-la.
            </p>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TransactionType)}
              className="w-full px-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {transactionTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {selectedAccount && !accountSupportsPositions(selectedAccount) &&
              (isStockTransaction || isDividendTransaction) && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Ce compte ne supporte pas les positions boursières — ce type de transaction sera refusé à l&apos;enregistrement.
                </p>
              )}
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

          {(isStockTransaction || isDividendTransaction) && (
            <div className="relative" ref={searchRef}>
              <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Action
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery || stockSymbol}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    setSearchQuery(value);
                    setStockSymbol(value);
                    setShowSearchDropdown(true);
                  }}
                  onFocus={() => setShowSearchDropdown(true)}
                  placeholder="Symbole ou nom"
                  className="w-full pl-10 pr-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 max-h-48 overflow-y-auto overscroll-contain">
                  {searchResults
                    .filter((r) =>
                      selectedAccount?.type === 'CRYPTO'
                        ? isCryptoSymbol(r.symbol)
                        : !isCryptoSymbol(r.symbol)
                    )
                    .map((result) => (
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
              {!searchQuery && !stockSymbol && (
                <div className="mt-2">
                  <div className="text-xs text-zinc-500 mb-1">
                    {selectedAccount?.type === 'CRYPTO' ? 'Cryptos populaires :' : 'Actions populaires :'}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(selectedAccount?.type === 'CRYPTO' ? POPULAR_CRYPTOS : POPULAR_FRENCH_STOCKS).slice(0, 6).map((stock) => (
                      <button
                        key={stock.symbol}
                        type="button"
                        onClick={() => handleSelectStock(stock.symbol, stock.name)}
                        className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                      >
                        {selectedAccount?.type === 'CRYPTO' ? stock.symbol.replace('-USD', '') : stock.symbol.replace('.PA', '')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {stockSymbol && stockName && (
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="font-medium text-sm text-blue-900 dark:text-blue-100">{stockSymbol}</div>
                  <div className="text-xs text-blue-700 dark:text-blue-300 truncate">{stockName}</div>
                </div>
              )}
            </div>
          )}

          {isStockTransaction && (
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
                  required
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
                  required
                  className="w-full px-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
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
                {linkedFee
                  ? 'Mettre 0 pour supprimer la ligne de frais associée.'
                  : 'Une ligne de frais sera créée si > 0.'}
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
            form="edit-tx-form"
            disabled={loading}
            className="flex-1 px-3 sm:px-4 py-2.5 text-sm sm:text-base font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
