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
 * @param accountId - (Optionnel) ID du compte pour filtrer les positions
 * @returns Map des positions par symbole
 */
export function calculatePositionsAtDate(
  transactions: Transaction[],
  asOfDate: string,
  accountId?: string
): Map<string, CalculatedPosition> {
  const positions = new Map<string, CalculatedPosition>();

  // Filtrer les transactions jusqu'à la date donnée, par compte si spécifié, et trier par date
  const relevantTransactions = transactions
    .filter(t => 
      t.date <= asOfDate && 
      t.stock_symbol && 
      ['BUY', 'SELL'].includes(t.type) &&
      (!accountId || t.account_id === accountId)
    )
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
 * Position calculée avec information du compte
 */
export interface CalculatedPositionWithAccount extends CalculatedPosition {
  accountId: string;
}

/**
 * Calcule les positions détenues à une date donnée pour TOUS les comptes
 * Retourne une Map avec clé "accountId:symbol" pour éviter les collisions
 * @param transactions - Liste de toutes les transactions
 * @param asOfDate - Date à laquelle calculer les positions (format YYYY-MM-DD)
 * @returns Map des positions par clé "accountId:symbol"
 */
export function calculateAllPositionsAtDate(
  transactions: Transaction[],
  asOfDate: string
): Map<string, CalculatedPositionWithAccount> {
  const positions = new Map<string, CalculatedPositionWithAccount>();

  // Filtrer les transactions jusqu'à la date donnée et trier par date
  const relevantTransactions = transactions
    .filter(t => t.date <= asOfDate && t.stock_symbol && ['BUY', 'SELL'].includes(t.type))
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const tx of relevantTransactions) {
    const symbol = tx.stock_symbol!.toUpperCase();
    const qty = tx.quantity || 0;
    const price = tx.price_per_unit || 0;
    const key = `${tx.account_id}:${symbol}`;

    const existing = positions.get(key);

    if (tx.type === 'BUY') {
      if (existing) {
        const newQuantity = existing.quantity + qty;
        const newTotalInvested = existing.totalInvested + (qty * price);
        const newAveragePrice = newQuantity > 0 ? newTotalInvested / newQuantity : 0;

        positions.set(key, {
          symbol,
          accountId: tx.account_id,
          quantity: newQuantity,
          averagePrice: newAveragePrice,
          totalInvested: newTotalInvested,
        });
      } else {
        positions.set(key, {
          symbol,
          accountId: tx.account_id,
          quantity: qty,
          averagePrice: price,
          totalInvested: qty * price,
        });
      }
    } else if (tx.type === 'SELL' && existing) {
      const newQuantity = existing.quantity - qty;
      
      if (newQuantity <= 0) {
        positions.delete(key);
      } else {
        positions.set(key, {
          symbol,
          accountId: tx.account_id,
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
 * Agrège les positions de tous les comptes par symbole (pour les totaux globaux)
 * @param positionsWithAccount - Map des positions par compte
 * @returns Map des positions agrégées par symbole
 */
export function aggregatePositionsBySymbol(
  positionsWithAccount: Map<string, CalculatedPositionWithAccount>
): Map<string, CalculatedPosition> {
  const aggregated = new Map<string, CalculatedPosition>();

  positionsWithAccount.forEach((pos) => {
    const existing = aggregated.get(pos.symbol);
    if (existing) {
      const newQuantity = existing.quantity + pos.quantity;
      const newTotalInvested = existing.totalInvested + pos.totalInvested;
      const newAveragePrice = newQuantity > 0 ? newTotalInvested / newQuantity : 0;

      aggregated.set(pos.symbol, {
        symbol: pos.symbol,
        quantity: newQuantity,
        averagePrice: newAveragePrice,
        totalInvested: newTotalInvested,
      });
    } else {
      aggregated.set(pos.symbol, {
        symbol: pos.symbol,
        quantity: pos.quantity,
        averagePrice: pos.averagePrice,
        totalInvested: pos.totalInvested,
      });
    }
  });

  return aggregated;
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
  // Comptes actions (PEA/CTO)
  const stockAccounts = accounts.filter(a => ['PEA', 'CTO'].includes(a.type));
  
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

    // Calculer le cash disponible sur les comptes PEA/CTO à cette date
    let stockAccountsCash = 0;
    for (const acc of stockAccounts) {
      stockAccountsCash += calculateAccountCashAtDate(transactions, acc.id, date);
    }

    // Calculer la valeur des comptes épargne à cette date (basée sur les transactions)
    let savingsValue = 0;
    for (const acc of savingsAccounts) {
      savingsValue += calculateAccountCashAtDate(transactions, acc.id, date);
    }

    history.push({
      date,
      totalValue: stocksValue + stockAccountsCash + savingsValue,
      stocksValue: stocksValue + stockAccountsCash, // Actions + cash PEA/CTO
      savingsValue,
      positions: positionDetails,
    });
  }

  return history;
}

/**
 * Calcule le cash/solde d'un compte à une date donnée (basé uniquement sur les transactions)
 */
export function calculateAccountCashAtDate(
  transactions: Transaction[],
  accountId: string,
  asOfDate: string
): number {
  const relevantTransactions = transactions
    .filter(t => t.account_id === accountId && t.date <= asOfDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  let cash = 0;

  for (const tx of relevantTransactions) {
    switch (tx.type) {
      case 'DEPOSIT':
      case 'DIVIDEND':
      case 'INTEREST':
        cash += tx.amount;
        break;
      case 'SELL':
        cash += tx.amount;
        break;
      case 'WITHDRAWAL':
      case 'FEE':
        cash -= tx.amount;
        break;
      case 'BUY':
        cash -= tx.amount;
        break;
    }
  }

  return cash;
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

/**
 * Performance d'une année
 */
export interface YearlyPerformance {
  year: number;
  startValue: number;
  endValue: number;
  deposits: number;
  withdrawals: number;
  netFlows: number;
  dividends: number;
  gainLoss: number;
  gainLossPercent: number;
  totalReturn: number;
  totalReturnPercent: number;
}

/**
 * Interface pour les données de performance du portefeuille
 */
export interface PortfolioPerformanceData {
  // Valeurs actuelles
  currentValue: number;
  totalDeposits: number;
  totalWithdrawals: number;
  netDeposits: number;
  
  // Performance absolue globale
  absoluteGain: number;
  absoluteGainPercent: number;
  
  // Dividendes reçus
  totalDividends: number;
  
  // Performance avec dividendes
  totalReturn: number;
  totalReturnPercent: number;
  
  // Performance par année
  yearlyPerformance: YearlyPerformance[];
  
  // Année en cours
  currentYearPerformance: YearlyPerformance | null;
}

/**
 * Calcule la performance du portefeuille par année
 */
export function calculatePortfolioPerformance(
  transactions: Transaction[],
  portfolioHistory: PortfolioHistoryPoint[],
  accounts: Account[]
): PortfolioPerformanceData {
  const emptyResult: PortfolioPerformanceData = {
    currentValue: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    netDeposits: 0,
    absoluteGain: 0,
    absoluteGainPercent: 0,
    totalDividends: 0,
    totalReturn: 0,
    totalReturnPercent: 0,
    yearlyPerformance: [],
    currentYearPerformance: null,
  };

  if (portfolioHistory.length === 0) {
    return emptyResult;
  }

  // Comptes PEA/CTO uniquement
  const stockAccountIds = new Set(
    accounts.filter(a => ['PEA', 'CTO'].includes(a.type)).map(a => a.id)
  );

  // Filtrer les transactions pour les comptes actions uniquement
  const stockTransactions = transactions.filter(t => stockAccountIds.has(t.account_id));

  // Calculer les totaux globaux
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let totalDividends = 0;

  stockTransactions.forEach(tx => {
    if (tx.type === 'DEPOSIT') {
      totalDeposits += tx.amount;
    } else if (tx.type === 'WITHDRAWAL') {
      totalWithdrawals += tx.amount;
    } else if (tx.type === 'DIVIDEND') {
      totalDividends += tx.amount;
    }
  });

  const netDeposits = totalDeposits - totalWithdrawals;
  const currentValue = portfolioHistory[portfolioHistory.length - 1]?.stocksValue || 0;
  
  // Performance absolue globale (les dividendes sont DÉJÀ inclus dans currentValue car ils augmentent le cash)
  // absoluteGain = currentValue - netDeposits = (actions + cash avec dividendes) - (dépôts - retraits)
  // Donc absoluteGain inclut déjà les dividendes réinvestis ou en cash
  const absoluteGain = currentValue - netDeposits;
  const absoluteGainPercent = netDeposits > 0 ? (absoluteGain / netDeposits) * 100 : 0;
  
  // Performance totale = même que absoluteGain car dividendes déjà inclus
  // totalDividends est affiché séparément comme information (montant reçu)
  // mais ne doit PAS être re-additionné pour éviter le double comptage
  const totalReturn = absoluteGain;
  const totalReturnPercent = absoluteGainPercent;

  // Calculer la performance par année
  const yearlyPerformance = calculateYearlyPerformance(portfolioHistory, stockTransactions);
  
  // Identifier l'année en cours
  const currentYear = new Date().getFullYear();
  const currentYearPerformance = yearlyPerformance.find(y => y.year === currentYear) || null;

  return {
    currentValue,
    totalDeposits,
    totalWithdrawals,
    netDeposits,
    absoluteGain,
    absoluteGainPercent,
    totalDividends,
    totalReturn,
    totalReturnPercent,
    yearlyPerformance,
    currentYearPerformance,
  };
}

/**
 * Calcule la performance pour chaque année
 * Utilise la méthode Modified Dietz pour un calcul précis du rendement
 */
function calculateYearlyPerformance(
  history: PortfolioHistoryPoint[],
  transactions: Transaction[]
): YearlyPerformance[] {
  if (history.length === 0) return [];

  // Trouver toutes les années présentes dans l'historique
  const allYears = new Set<number>();
  history.forEach(point => {
    allYears.add(new Date(point.date).getFullYear());
  });

  const years = Array.from(allYears).sort();
  const yearlyPerformance: YearlyPerformance[] = [];

  for (let i = 0; i < years.length; i++) {
    const year = years[i];
    
    // Filtrer et trier l'historique pour cette année
    const yearHistory = history
      .filter(point => new Date(point.date).getFullYear() === year)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (yearHistory.length === 0) continue;

    // Déterminer les bornes de l'année
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const daysInYear = isLeapYear(year) ? 366 : 365;

    // Valeur de début d'année
    let startValue: number;
    let effectiveStartDate: string;
    
    if (i === 0) {
      // Première année : la valeur de début est la première valeur disponible
      // Les flux AVANT cette date ne comptent pas (c'est le capital initial)
      startValue = yearHistory[0].stocksValue;
      effectiveStartDate = yearHistory[0].date;
    } else {
      // Chercher la dernière valeur de l'année précédente
      const prevYear = years[i - 1];
      const prevYearHistory = history
        .filter(point => new Date(point.date).getFullYear() === prevYear)
        .sort((a, b) => b.date.localeCompare(a.date));
      
      if (prevYearHistory.length > 0) {
        startValue = prevYearHistory[0].stocksValue;
      } else {
        startValue = yearHistory[0].stocksValue;
      }
      effectiveStartDate = yearStart;
    }
    
    // Valeur de fin = dernière valeur de l'année
    const endValue = yearHistory[yearHistory.length - 1].stocksValue;
    const effectiveEndDate = yearHistory[yearHistory.length - 1].date;

    // Calculer les flux de l'année avec pondération temporelle (Modified Dietz)
    const yearTransactions = transactions.filter(tx => {
      const txDate = tx.date;
      // Pour la première année, ne compter que les flux APRÈS la date de début effective
      if (i === 0) {
        return txDate > effectiveStartDate && txDate <= effectiveEndDate;
      }
      return new Date(txDate).getFullYear() === year && txDate <= effectiveEndDate;
    });

    let deposits = 0;
    let withdrawals = 0;
    let dividends = 0;
    let weightedFlows = 0; // Somme des flux pondérés par le temps

    // Calculer le nombre de jours effectifs dans la période
    const startDateObj = new Date(effectiveStartDate);
    const endDateObj = new Date(effectiveEndDate);
    const effectiveDays = Math.max(1, Math.round((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)));

    yearTransactions.forEach(tx => {
      const txDate = new Date(tx.date);
      // Poids = proportion du temps restant après le flux
      const daysFromStart = Math.round((txDate.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
      const weight = Math.max(0, (effectiveDays - daysFromStart) / effectiveDays);

      if (tx.type === 'DEPOSIT') {
        deposits += tx.amount;
        weightedFlows += tx.amount * weight;
      } else if (tx.type === 'WITHDRAWAL') {
        withdrawals += tx.amount;
        weightedFlows -= tx.amount * weight;
      } else if (tx.type === 'DIVIDEND') {
        dividends += tx.amount;
        // Les dividendes ne sont PAS comptés dans les flux car ils sont déjà dans endValue
      }
    });

    const netFlows = deposits - withdrawals;

    // Gain/Perte de l'année = Valeur fin - Valeur début - Flux nets (dépôts - retraits)
    // Les dividendes sont DÉJÀ inclus dans endValue (ils augmentent le cash)
    const gainLoss = endValue - startValue - netFlows;
    
    // Pourcentage de performance (Modified Dietz)
    // Dénominateur = Capital de départ + flux pondérés par le temps
    const averageCapital = startValue + weightedFlows;
    const gainLossPercent = averageCapital > 0 ? (gainLoss / averageCapital) * 100 : 0;

    // Rendement total = même que gainLoss (dividendes déjà inclus dans la valeur)
    const totalReturnValue = gainLoss;
    const totalReturnPercent = gainLossPercent;

    yearlyPerformance.push({
      year,
      startValue,
      endValue,
      deposits,
      withdrawals,
      netFlows,
      dividends,
      gainLoss,
      gainLossPercent,
      totalReturn: totalReturnValue,
      totalReturnPercent,
    });
  }

  return yearlyPerformance;
}

/**
 * Vérifie si une année est bissextile
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}
