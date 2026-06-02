'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, Copy } from 'lucide-react';
import { Account, StockPosition, Transaction } from '@/lib/types';
import { useStockSearch } from '@/lib/hooks';
import { useLimitReached } from './LimitReachedModal';
import { POPULAR_FRENCH_STOCKS, POPULAR_CRYPTOS } from '@/lib/stock-api';
import { calculatePositionsAtDate, findCalculatedPosition } from '@/lib/portfolio-calculator';
import { getApiErrorMessage } from '@/lib/api-errors';
import {
  accountSupportsPositions,
  accountTypeAllowsAsset,
  assetAccountMismatchMessage,
  formatDate,
  formatCurrency,
  isCryptoSymbol,
} from '@/lib/utils';
import { findDuplicateTransaction } from '@/lib/transaction-duplicates';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  accounts: Account[];
  positions: StockPosition[];
  transactions: Transaction[];
  defaultAccountId?: string;
  defaultType?: Transaction['type'];
}

const transactionTypes = [
  { value: 'DEPOSIT', label: 'Dépôt' },
  { value: 'WITHDRAWAL', label: 'Retrait' },
  { value: 'BUY', label: 'Achat d\'action' },
  { value: 'SELL', label: 'Vente d\'action' },
  { value: 'DIVIDEND', label: 'Dividende' },
  { value: 'INTEREST', label: 'Intérêts' },
  { value: 'FEE', label: 'Frais' },
  { value: 'CONVERSION', label: 'Conversion de devises' },
];

// Devises proposées par défaut dans le sélecteur. La saisie libre reste
// possible (toute valeur 3-10 majuscules est acceptée par le backend).
const COMMON_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'USDC', 'USDT', 'BTC', 'ETH'];

const todayISO = () => new Date().toISOString().split('T')[0];

export function AddTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  accounts,
  positions,
  transactions,
  defaultAccountId,
  defaultType,
}: AddTransactionModalProps) {
  const [accountId, setAccountId] = useState(defaultAccountId || '');
  const [type, setType] = useState<Transaction['type']>(defaultType ?? 'DEPOSIT');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('');
  const [stockSymbol, setStockSymbol] = useState('');
  const [stockName, setStockName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [fees, setFees] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetCurrency, setTargetCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { results: searchResults, search } = useStockSearch();
  const limitReached = useLimitReached();
  const isStockTransaction = ['BUY', 'SELL'].includes(type);
  const isDividendTransaction = type === 'DIVIDEND';
  const isConversion = type === 'CONVERSION';
  const requiresPositionAccount = isStockTransaction || isDividendTransaction;
  const positionAccounts = useMemo(() => accounts.filter(accountSupportsPositions), [accounts]);
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId),
    [accounts, accountId]
  );
  const selectableAccounts = requiresPositionAccount ? positionAccounts : accounts;
  const isCryptoAccount = selectedAccount?.type === 'CRYPTO';
  const filteredSearchResults = useMemo(() => {
    if (!selectedAccount) return searchResults;
    return searchResults.filter((r) =>
      isCryptoAccount ? isCryptoSymbol(r.symbol) : !isCryptoSymbol(r.symbol)
    );
  }, [searchResults, selectedAccount, isCryptoAccount]);

  const resetForm = () => {
    setAccountId(defaultAccountId || '');
    setType(defaultType ?? 'DEPOSIT');
    setAmount('');
    setDescription('');
    setDate(todayISO());
    setTime('');
    setStockSymbol('');
    setStockName('');
    setQuantity('');
    setPricePerUnit('');
    setFees('');
    setCurrency(selectedAccount?.currency ?? 'EUR');
    setTargetAmount('');
    setTargetCurrency('USD');
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

  // Devise par défaut = devise du compte sélectionné. L'utilisateur peut la
  // surcharger via le sélecteur (multi-devise sur un même compte = OK).
  useEffect(() => {
    if (selectedAccount?.currency) {
      setCurrency(selectedAccount.currency.toUpperCase());
    }
  }, [selectedAccount?.currency]);

  useEffect(() => {
    if (!isOpen) return;
    setAccountId(defaultAccountId || '');
    setType(defaultType ?? 'DEPOSIT');
  }, [defaultAccountId, defaultType, isOpen]);

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

  // Détection en temps réel d'une transaction quasi-identique déjà en base.
  // Non-bloquante : on affiche un warning, l'utilisateur peut soumettre quand même.
  const duplicateMatch = useMemo(() => {
    if (!accountId) return null;
    const numAmount = parseFloat(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) return null;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const numQty = parseFloat(quantity);
    const numPrice = parseFloat(pricePerUnit);
    const numTargetAmount = parseFloat(targetAmount);
    return findDuplicateTransaction(
      {
        type: type as Transaction['type'],
        date,
        amount: numAmount,
        currency: currency.trim().toUpperCase(),
        stock_symbol: stockSymbol ? stockSymbol.toUpperCase() : null,
        quantity: Number.isFinite(numQty) ? numQty : null,
        price_per_unit: Number.isFinite(numPrice) ? numPrice : null,
        target_amount: Number.isFinite(numTargetAmount) ? numTargetAmount : null,
        target_currency: targetCurrency ? targetCurrency.trim().toUpperCase() : null,
      },
      transactions,
      { accountId }
    );
  }, [accountId, type, date, amount, currency, stockSymbol, quantity, pricePerUnit, targetAmount, targetCurrency, transactions]);

  if (!isOpen) return null;

  const handleSelectStock = (symbol: string, name: string) => {
    setStockSymbol(symbol);
    setStockName(name);
    setSearchQuery('');
    setShowSearchDropdown(false);
  };

  const handleSelectExistingPosition = (position: StockPosition) => {
    setStockSymbol(position.symbol);
    setStockName(position.name);
    setCurrency((position.currency ?? 'EUR').toUpperCase());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!accountId) {
        throw new Error('Veuillez sélectionner un compte');
      }
      if (requiresPositionAccount && (!selectedAccount || !accountSupportsPositions(selectedAccount))) {
        throw new Error('Ce type de transaction doit être rattaché à un compte pouvant détenir des positions');
      }
      if (
        selectedAccount &&
        (isStockTransaction || isDividendTransaction) &&
        stockSymbol &&
        !accountTypeAllowsAsset(selectedAccount.type, stockSymbol)
      ) {
        throw new Error(assetAccountMismatchMessage(selectedAccount.type));
      }

      const qty = parseFloat(quantity) || 0;
      const price = parseFloat(pricePerUnit) || 0;
      const totalAmount = parseFloat(amount) || 0;
      const feesAmount = Math.max(0, parseFloat(fees) || 0);
      const targetAmt = parseFloat(targetAmount) || 0;
      const normalizedCurrency = currency.trim().toUpperCase();
      const normalizedTargetCurrency = targetCurrency.trim().toUpperCase();

      // Validation côté client (UX feedback rapide). Le serveur re-valide.
      if (isStockTransaction) {
        if (!stockSymbol) throw new Error('Veuillez sélectionner une action');
        if (qty <= 0) throw new Error('La quantité doit être supérieure à 0');
        if (price <= 0) throw new Error('Le prix unitaire doit être supérieur à 0');
      }

      if (isDividendTransaction && !stockSymbol) {
        throw new Error('Veuillez sélectionner l\'action associée au dividende');
      }

      if (totalAmount <= 0) {
        throw new Error('Le montant doit être supérieur à 0');
      }
      if (!/^[A-Z]{3,10}$/.test(normalizedCurrency)) {
        throw new Error('Code devise invalide');
      }

      if (isConversion) {
        if (!/^[A-Z]{3,10}$/.test(normalizedTargetCurrency)) {
          throw new Error('Code devise cible invalide');
        }
        if (normalizedCurrency === normalizedTargetCurrency) {
          throw new Error('La devise cible doit être différente de la devise source');
        }
        if (targetAmt <= 0) {
          throw new Error('Le montant cible doit être supérieur à 0');
        }
      }

      // Pré-validation locale pour SELL : on rejette tôt si la position est insuffisante
      // à la date choisie sur ce compte. Le serveur re-vérifie de toute façon.
      if (type === 'SELL') {
        const positionsAtDate = calculatePositionsAtDate(transactions, date, accountId);
        const positionAtDate = findCalculatedPosition(
          positionsAtDate,
          stockSymbol.toUpperCase(),
          normalizedCurrency
        );
        if (!positionAtDate || positionAtDate.quantity < qty) {
          throw new Error(
            `Position ${normalizedCurrency} insuffisante sur ce compte au ${date}. Vous aviez ${positionAtDate?.quantity || 0} titres.`
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
        time: string | null;
        currency: string;
        stock_symbol?: string;
        quantity?: number;
        price_per_unit?: number;
        target_amount?: number;
        target_currency?: string;
      } = {
        account_id: accountId,
        type,
        amount: totalAmount,
        fees: feesAmount,
        // Heure optionnelle pour ordonner explicitement les opérations du jour.
        // null => l'ordre retombe sur l'heure synthétique dérivée du type.
        time: time.trim() ? time.trim() : null,
        description:
          description ||
          (isStockTransaction
            ? `${type === 'BUY' ? 'Achat' : 'Vente'} ${qty} x ${stockSymbol}`
            : isDividendTransaction && stockSymbol
              ? `Dividende ${stockSymbol}`
              : isConversion
                ? `Conversion ${normalizedCurrency} → ${normalizedTargetCurrency}`
                : ''),
        date,
        currency: normalizedCurrency,
      };

      if (isStockTransaction) {
        payload.stock_symbol = stockSymbol.toUpperCase();
        payload.quantity = qty;
        payload.price_per_unit = price;
      }

      if (isDividendTransaction && stockSymbol) {
        payload.stock_symbol = stockSymbol.toUpperCase();
      }

      if (isConversion) {
        payload.target_amount = targetAmt;
        payload.target_currency = normalizedTargetCurrency;
        // Une CONVERSION ne porte pas de frais classiques côté UX.
        payload.fees = 0;
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
        throw new Error(getApiErrorMessage(data, 'État du compte invalide après cette transaction.', res.status));
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(data, 'Erreur lors de la création de la transaction.', res.status));
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
              {selectableAccounts.map((account) => (
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
              onChange={(e) => {
                const nextType = e.target.value as Transaction['type'];
                setType(nextType);
                if (
                  ['BUY', 'SELL', 'DIVIDEND'].includes(nextType) &&
                  selectedAccount &&
                  !accountSupportsPositions(selectedAccount)
                ) {
                  setAccountId('');
                }
              }}
              className="w-full px-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {transactionTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="col-span-2">
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
            <div>
              <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Heure <span className="text-zinc-400 text-xs">(optionnel)</span>
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-2 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {time && (
              <p className="col-span-3 -mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                L&apos;heure permet d&apos;ordonner précisément les opérations d&apos;un même jour.
              </p>
            )}
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
                        && currency.toUpperCase() === (pos.currency ?? 'EUR').toUpperCase()
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                        : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{pos.symbol}</div>
                    <div className="text-xs text-zinc-500 truncate">{pos.name}</div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">{(pos.currency ?? 'EUR').toUpperCase()}</div>
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
                            && currency.toUpperCase() === (pos.currency ?? 'EUR').toUpperCase()
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{pos.symbol}</div>
                        <div className="text-xs text-zinc-500 truncate">{pos.quantity} titres</div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">{(pos.currency ?? 'EUR').toUpperCase()}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {type === 'BUY' && (
                <div className="relative" ref={searchRef}>
                  <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {isCryptoAccount ? 'Rechercher une crypto' : 'Rechercher une action'}
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
                      placeholder={isCryptoAccount ? 'Bitcoin, ETH...' : 'Rechercher...'}
                      className="w-full pl-10 pr-3 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {showSearchDropdown && filteredSearchResults.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 max-h-48 overflow-y-auto overscroll-contain">
                      {filteredSearchResults.map((result) => (
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
                      <div className="text-xs text-zinc-500 mb-1">
                        {isCryptoAccount ? 'Cryptos populaires :' : 'Actions populaires :'}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(isCryptoAccount ? POPULAR_CRYPTOS : POPULAR_FRENCH_STOCKS).slice(0, 6).map((stock) => (
                          <button
                            key={stock.symbol}
                            type="button"
                            onClick={() => handleSelectStock(stock.symbol, stock.name)}
                            className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                          >
                            {isCryptoAccount ? stock.symbol.replace('-USD', '') : stock.symbol.replace('.PA', '')}
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
                    Prix unitaire ({currency})
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

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="col-span-2">
              <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {isConversion ? `Montant débité (${currency})` : `Montant (${currency})`}{' '}
                {isStockTransaction && <span className="text-zinc-400 text-xs">(auto)</span>}
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
            <div>
              <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Devise
              </label>
              <input
                type="text"
                list="common-currencies-source"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={10}
                className="w-full px-2 py-2 text-sm sm:text-base border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
              />
              <datalist id="common-currencies-source">
                {COMMON_CURRENCIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          {isConversion && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                  Montant crédité ({targetCurrency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full px-3 py-2 text-sm sm:text-base border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                  Devise cible
                </label>
                <input
                  type="text"
                  list="common-currencies-target"
                  value={targetCurrency}
                  onChange={(e) => setTargetCurrency(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="w-full px-2 py-2 text-sm sm:text-base border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 uppercase"
                />
                <datalist id="common-currencies-target">
                  {COMMON_CURRENCIES.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              {parseFloat(amount) > 0 && parseFloat(targetAmount) > 0 && (
                <div className="col-span-3 text-xs text-amber-700 dark:text-amber-300">
                  Taux implicite : 1 {currency} = {(parseFloat(targetAmount) / parseFloat(amount)).toFixed(4)} {targetCurrency}
                </div>
              )}
            </div>
          )}

          {type !== 'FEE' && !isConversion && (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Frais ({currency}) <span className="text-zinc-400 text-xs">optionnel</span>
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

          {duplicateMatch && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs sm:text-sm text-amber-800 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <Copy className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-medium">Doublon possible</div>
                  <div className="mt-0.5 text-[11px] sm:text-xs">
                    Une transaction très similaire existe déjà : {duplicateMatch.type}
                    {duplicateMatch.stock_symbol ? ` ${duplicateMatch.stock_symbol}` : ''} de{' '}
                    {formatCurrency(Number(duplicateMatch.amount), duplicateMatch.currency)} le {formatDate(duplicateMatch.date)}.
                    Vérifiez qu&apos;il ne s&apos;agit pas d&apos;une saisie en double.
                  </div>
                </div>
              </div>
            </div>
          )}

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
