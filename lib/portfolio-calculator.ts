import { Transaction, Account } from './types';
import { HistoricalQuote, findClosestQuote } from './stock-api';

/**
 * Représente une position calculée à partir des transactions
 */
export interface CalculatedPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  totalInvested: number;
}

/**
 * Calcule les positions détenues à une date donnée basées sur les transactions
 * @param transactions - Liste de toutes les transactions
 * @param asOfDate - Date à laquelle calculer les positions (format YYYY-MM-DD)
 * @returns Map des positions par symbole
 */
export function calculatePositionsAtDate(
  transactions: Transaction[],
  asOfDate: string
): Map<string, CalculatedPosition> {
  const positions = new Map<string, CalculatedPosition>();

  // Filtrer les transactions jusqu'à la date donnée et trier par date
  const relevantTransactions = transactions
    .filter(t => t.date <= asOfDate && t.stock_symbol && ['BUY', 'SELL'].includes(t.type))
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const tx of relevantTransactions) {
    const symbol = tx.stock_symbol!.toUpperCase();
    const qty = tx.quantity || 0;
    const price = tx.price_per_unit || 0;

    const existing = positions.get(symbol);

    if (tx.type === 'BUY') {
      if (existing) {
        // Calculer le nouveau PRU
        const newQuantity = existing.quantity + qty;
        const newTotalInvested = existing.totalInvested + (qty * price);
        const newAveragePrice = newTotalInvested / newQuantity;

        positions.set(symbol, {
          symbol,
          quantity: newQuantity,
          averagePrice: newAveragePrice,
          totalInvested: newTotalInvested,
        });
      } else {
        positions.set(symbol, {
          symbol,
          quantity: qty,
          averagePrice: price,
          totalInvested: qty * price,
        });
      }
    } else if (tx.type === 'SELL' && existing) {
      const newQuantity = existing.quantity - qty;
      
      if (newQuantity <= 0) {
        positions.delete(symbol);
      } else {
        // Le PRU reste inchangé lors d'une vente
        positions.set(symbol, {
          symbol,
          quantity: newQuantity,
          averagePrice: existing.averagePrice,
          totalInvested: newQuantity * existing.averagePrice,
        });
      }
    }
  }

  return positions;
}

/**
 * Calcule le solde d'un compte à une date donnée
 */
export function calculateAccountBalanceAtDate(
  transactions: Transaction[],
  accountId: string,
  initialBalance: number,
  asOfDate: string
): number {
  const relevantTransactions = transactions
    .filter(t => t.account_id === accountId && t.date <= asOfDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  let balance = initialBalance;

  for (const tx of relevantTransactions) {
    switch (tx.type) {
      case 'DEPOSIT':
      case 'DIVIDEND':
      case 'INTEREST':
      case 'SELL':
        balance += tx.amount;
        break;
      case 'WITHDRAWAL':
      case 'BUY':
      case 'FEE':
        balance -= tx.amount;
        break;
    }
  }

  return balance;
}

/**
 * Point de données pour l'historique du portefeuille
 */
export interface PortfolioHistoryPoint {
  date: string;
  totalValue: number;
  stocksValue: number;
  savingsValue: number;
  positions: Array<{
    symbol: string;
    quantity: number;
    price: number;
    value: number;
  }>;
}

/**
 * Calcule l'historique du portefeuille sur une période
 * @param transactions - Toutes les transactions
 * @param accounts - Tous les comptes
 * @param historicalQuotes - Cours historiques par symbole
 * @param startDate - Date de début
 * @param endDate - Date de fin
 * @param interval - Intervalle entre les points ('daily', 'weekly', 'monthly')
 */
export function calculatePortfolioHistory(
  transactions: Transaction[],
  accounts: Account[],
  historicalQuotes: Record<string, HistoricalQuote[]>,
  startDate: string,
  endDate: string,
  interval: 'daily' | 'weekly' | 'monthly' = 'daily'
): PortfolioHistoryPoint[] {
  const history: PortfolioHistoryPoint[] = [];
  
  // Générer les dates selon l'intervalle
  const dates = generateDateRange(startDate, endDate, interval);

  // Comptes épargne (non-actions)
  const savingsAccounts = accounts.filter(a => !['PEA', 'CTO'].includes(a.type));
  
  for (const date of dates) {
    // Calculer les positions à cette date
    const positions = calculatePositionsAtDate(transactions, date);
    
    // Calculer la valeur des actions
    let stocksValue = 0;
    const positionDetails: PortfolioHistoryPoint['positions'] = [];

    positions.forEach((pos) => {
      const quotes = historicalQuotes[pos.symbol];
      const quote = quotes ? findClosestQuote(quotes, date) : null;
      const price = quote?.close || pos.averagePrice; // Fallback au PRU si pas de cours
      const value = pos.quantity * price;
      
      stocksValue += value;
      positionDetails.push({
        symbol: pos.symbol,
        quantity: pos.quantity,
        price,
        value,
      });
    });

    // Calculer la valeur des comptes épargne
    // Pour simplifier, on utilise le solde actuel (pourrait être amélioré avec les transactions)
    const savingsValue = savingsAccounts.reduce((sum, acc) => sum + acc.balance, 0);

    history.push({
      date,
      totalValue: stocksValue + savingsValue,
      stocksValue,
      savingsValue,
      positions: positionDetails,
    });
  }

  return history;
}

/**
 * Génère une liste de dates entre startDate et endDate
 */
function generateDateRange(
  startDate: string,
  endDate: string,
  interval: 'daily' | 'weekly' | 'monthly'
): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);

    switch (interval) {
      case 'daily':
        current.setDate(current.getDate() + 1);
        break;
      case 'weekly':
        current.setDate(current.getDate() + 7);
        break;
      case 'monthly':
        current.setMonth(current.getMonth() + 1);
        break;
    }
  }

  return dates;
}

/**
 * Trouve la première date de transaction (pour déterminer le début de l'historique)
 */
export function getFirstTransactionDate(transactions: Transaction[]): string | null {
  if (transactions.length === 0) return null;
  
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  return sorted[0].date;
}

/**
 * Extrait tous les symboles uniques des transactions
 */
export function getUniqueSymbolsFromTransactions(transactions: Transaction[]): string[] {
  const symbols = new Set<string>();
  
  transactions.forEach(tx => {
    if (tx.stock_symbol) {
      symbols.add(tx.stock_symbol.toUpperCase());
    }
  });

  return Array.from(symbols);
}

/**
 * Calcule le cash d'un compte PEA/CTO uniquement depuis les transactions (sans solde initial)
 * Le cash est calculé comme : dépôts - retraits - achats + ventes + dividendes - frais
 */
export function calculateAccountCashFromTransactions(
  transactions: Transaction[],
  accountId: string
): number {
  const accountTransactions = transactions.filter(t => t.account_id === accountId);
  
  let cash = 0;

  for (const tx of accountTransactions) {
    switch (tx.type) {
      case 'DEPOSIT':
      case 'DIVIDEND':
      case 'INTEREST':
        cash += tx.amount;
        break;
      case 'SELL':
        // Pour une vente, amount = quantity * price
        cash += tx.amount;
        break;
      case 'WITHDRAWAL':
      case 'FEE':
        cash -= tx.amount;
        break;
      case 'BUY':
        // Pour un achat, amount = quantity * price
        cash -= tx.amount;
        break;
    }
  }

  return cash;
}

/**
 * Valeur calculée d'un compte avec détail
 */
export interface AccountCalculatedValue {
  accountId: string;
  cash: number;
  stocksValue: number;
  totalValue: number;
}

/**
 * Calcule la valeur totale d'un compte PEA/CTO
 * @param transactions - Toutes les transactions
 * @param accountId - ID du compte
 * @param positions - Positions actuelles du compte
 * @param quotes - Cours actuels
 */
export function calculateAccountTotalValue(
  transactions: Transaction[],
  accountId: string,
  positions: Array<{ symbol: string; quantity: number; current_price: number }>,
  quotes: Record<string, { price: number }>
): AccountCalculatedValue {
  // Calculer le cash
  const cash = calculateAccountCashFromTransactions(transactions, accountId);

  // Calculer la valeur des positions
  let stocksValue = 0;
  for (const pos of positions) {
    const quote = quotes[pos.symbol];
    const price = quote?.price || pos.current_price;
    stocksValue += pos.quantity * price;
  }

  return {
    accountId,
    cash,
    stocksValue,
    totalValue: cash + stocksValue,
  };
}
