'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Account, StockPosition, Transaction } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useStockSearch } from '@/lib/hooks';
import { POPULAR_FRENCH_STOCKS } from '@/lib/stock-api';
import { calculatePositionsAtDate } from '@/lib/portfolio-calculator';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accounts: Account[];
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

export function AddTransactionModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  accounts,
  defaultAccountId 
}: AddTransactionModalProps) {
  const [accountId, setAccountId] = useState(defaultAccountId || '');
  const [type, setType] = useState('DEPOSIT');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [stockSymbol, setStockSymbol] = useState('');
  const [stockName, setStockName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [existingPositions, setExistingPositions] = useState<StockPosition[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const { user } = useAuth();
  const { results: searchResults, search } = useStockSearch();

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

  // Charger les positions existantes et toutes les transactions pour le compte
  const loadExistingPositions = useCallback(async () => {
    if (!user) return;
    
    // Charger les positions de TOUS les comptes de l'utilisateur (pour les dividendes)
    const { data: allPositions } = await supabase
      .from('stock_positions')
      .select('*')
      .eq('user_id', user.id);
    
    if (allPositions) {
      // Dédupliquer par symbole (au cas où une action serait sur plusieurs comptes)
      const uniquePositions = allPositions.reduce((acc: StockPosition[], pos) => {
        if (!acc.find(p => p.symbol === pos.symbol)) {
          acc.push(pos);
        }
        return acc;
      }, []);
      setExistingPositions(uniquePositions);
    }

    // Charger toutes les transactions pour calculer les positions à une date donnée
    if (accountId) {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('account_id', accountId)
        .eq('user_id', user.id)
        .order('date', { ascending: true });
      
      if (transactions) {
        setAllTransactions(transactions);
      }
    }
  }, [accountId, user]);

  useEffect(() => {
    loadExistingPositions();
  }, [loadExistingPositions]);

  if (!isOpen) return null;

  const isStockTransaction = ['BUY', 'SELL'].includes(type);
  const isDividendTransaction = type === 'DIVIDEND';
  const needsStockSelection = isStockTransaction || isDividendTransaction;
  const selectedAccount = accounts.find(a => a.id === accountId);
  const isStockAccount = selectedAccount && ['PEA', 'CTO'].includes(selectedAccount.type);

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

    if (!user) {
      setError('Vous devez être connecté');
      setLoading(false);
      return;
    }

    try {
      const qty = parseFloat(quantity) || 0;
      const price = parseFloat(pricePerUnit) || 0;
      const totalAmount = parseFloat(amount) || 0;

      // Validation pour les transactions d'actions
      if (isStockTransaction) {
        if (!stockSymbol) {
          throw new Error('Veuillez sélectionner une action');
        }
        if (qty <= 0) {
          throw new Error('La quantité doit être supérieure à 0');
        }
        if (price <= 0) {
          throw new Error('Le prix unitaire doit être supérieur à 0');
        }
      }

      // Validation pour les dividendes
      if (isDividendTransaction && !stockSymbol) {
        throw new Error('Veuillez sélectionner l\'action associée au dividende');
      }

      // Pour une vente, vérifier qu'on a assez de titres À LA DATE de la transaction
      if (type === 'SELL') {
        // Calculer les positions à la date de la transaction
        const positionsAtDate = calculatePositionsAtDate(allTransactions, date);
        const positionAtDate = positionsAtDate.get(stockSymbol.toUpperCase());
        
        if (!positionAtDate || positionAtDate.quantity < qty) {
          throw new Error(`Position insuffisante à la date ${date}. Vous aviez ${positionAtDate?.quantity || 0} titres.`);
        }
      }

      // 1. Créer la transaction
      const transactionData: {
        user_id: string;
        account_id: string;
        type: string;
        amount: number;
        description: string;
        date: string;
        stock_symbol?: string;
        quantity?: number;
        price_per_unit?: number;
      } = {
        user_id: user.id,
        account_id: accountId,
        type,
        amount: totalAmount,
        description: description || (isStockTransaction ? `${type === 'BUY' ? 'Achat' : 'Vente'} ${qty} x ${stockSymbol}` : (isDividendTransaction && stockSymbol ? `Dividende ${stockSymbol}` : '')),
        date,
      };

      if (isStockTransaction) {
        transactionData.stock_symbol = stockSymbol.toUpperCase();
        transactionData.quantity = qty;
        transactionData.price_per_unit = price;
      }

      // Ajouter le symbole pour les dividendes
      if (isDividendTransaction && stockSymbol) {
        transactionData.stock_symbol = stockSymbol.toUpperCase();
      }

      const { error: transactionError } = await supabase.from('transactions').insert(transactionData);
      if (transactionError) throw transactionError;

      // 2. Mettre à jour le solde du compte
      const account = accounts.find(a => a.id === accountId);
      if (account) {
        let balanceChange = totalAmount;
        if (['WITHDRAWAL', 'BUY', 'FEE'].includes(type)) {
          balanceChange = -balanceChange;
        }

        await supabase
          .from('accounts')
          .update({ balance: account.balance + balanceChange })
          .eq('id', accountId);
      }

      // 3. Mettre à jour les positions pour les achats/ventes
      if (isStockTransaction) {
        const symbolUpper = stockSymbol.toUpperCase();
        
        // Chercher si une position existe déjà
        const { data: existingPos } = await supabase
          .from('stock_positions')
          .select('*')
          .eq('account_id', accountId)
          .eq('user_id', user.id)
          .eq('symbol', symbolUpper)
          .single();

        if (type === 'BUY') {
          if (existingPos) {
            // Mettre à jour la position existante (calculer nouveau PRU)
            const newQuantity = existingPos.quantity + qty;
            const newAveragePrice = 
              ((existingPos.quantity * existingPos.average_price) + (qty * price)) / newQuantity;

            await supabase
              .from('stock_positions')
              .update({
                quantity: newQuantity,
                average_price: newAveragePrice,
                current_price: price,
              })
              .eq('id', existingPos.id);
          } else {
            // Créer une nouvelle position
            await supabase.from('stock_positions').insert({
              user_id: user.id,
              account_id: accountId,
              symbol: symbolUpper,
              name: stockName || symbolUpper,
              quantity: qty,
              average_price: price,
              current_price: price,
              currency: 'EUR',
            });
          }
        } else if (type === 'SELL' && existingPos) {
          const newQuantity = existingPos.quantity - qty;
          
          if (newQuantity <= 0) {
            // Supprimer la position si plus de titres
            await supabase
              .from('stock_positions')
              .delete()
              .eq('id', existingPos.id);
          } else {
            // Mettre à jour la quantité (PRU reste inchangé)
            await supabase
              .from('stock_positions')
              .update({
                quantity: newQuantity,
                current_price: price,
              })
              .eq('id', existingPos.id);
          }
        }
      }

      // Reset form
      setAmount('');
      setDescription('');
      setStockSymbol('');
      setStockName('');
      setQuantity('');
      setPricePerUnit('');
      setSearchQuery('');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          Ajouter une transaction
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Compte
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {transactionTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Sélection d'action pour les dividendes */}
          {isDividendTransaction && existingPositions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Action concernée par le dividende
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {existingPositions.map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => handleSelectExistingPosition(pos)}
                    className={`text-left p-2 rounded-lg border text-sm transition-colors ${
                      stockSymbol.toUpperCase() === pos.symbol.toUpperCase()
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                        : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{pos.symbol}</div>
                    <div className="text-xs text-zinc-500">{pos.name}</div>
                  </button>
                ))}
              </div>
              {stockSymbol && (
                <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-emerald-700 dark:text-emerald-300">
                      Dividende pour <span className="font-semibold">{stockSymbol}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setStockSymbol(''); setStockName(''); }}
                      className="text-emerald-500 hover:text-emerald-700"
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
              {/* Pour les ventes, afficher les positions existantes */}
              {type === 'SELL' && existingPositions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Sélectionner une position à vendre
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {existingPositions.map((pos) => (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() => handleSelectExistingPosition(pos)}
                        className={`text-left p-2 rounded-lg border text-sm transition-colors ${
                          stockSymbol.toUpperCase() === pos.symbol.toUpperCase()
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">{pos.symbol}</div>
                        <div className="text-xs text-zinc-500">{pos.quantity} titres</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pour les achats, recherche d'action */}
              {type === 'BUY' && (
                <div className="relative" ref={searchRef}>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
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
                      placeholder="Rechercher par nom ou symbole..."
                      className="w-full pl-10 pr-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {showSearchDropdown && searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 max-h-48 overflow-y-auto">
                      {searchResults.map((result) => (
                        <button
                          key={result.symbol}
                          type="button"
                          onClick={() => handleSelectStock(result.symbol, result.name)}
                          className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 border-b border-zinc-100 dark:border-zinc-700 last:border-0"
                        >
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">{result.symbol}</div>
                          <div className="text-sm text-zinc-500 truncate">{result.name}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Actions populaires */}
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

              {/* Affichage de l'action sélectionnée */}
              {stockSymbol && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-blue-900 dark:text-blue-100">{stockSymbol}</div>
                      <div className="text-sm text-blue-700 dark:text-blue-300">{stockName}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setStockSymbol(''); setStockName(''); }}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Quantité
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required={isStockTransaction}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Prix unitaire (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
                    required={isStockTransaction}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Montant total (€) {isStockTransaction && <span className="text-zinc-400 text-xs">(calculé automatiquement)</span>}
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              readOnly={isStockTransaction}
              className={`w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isStockTransaction ? 'bg-zinc-50 dark:bg-zinc-900' : ''}`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Virement mensuel"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
