import type { ProposedTransaction } from './types';
import type { Transaction, TransactionType } from '@/lib/types';
import { effectiveTime } from '@/lib/transaction-ordering';

export type ImportCashPreviewBucket = {
  currency: string;
  before: number;
  importDelta: number;
  after: number;
};

export type ImportCashPreviewIssue = {
  currency: string;
  date: string;
  balance: number;
  type: TransactionType;
  amount: number;
  rowIndex: number | null;
  description: string;
};

export type ImportCashPreview = {
  buckets: ImportCashPreviewBucket[];
  firstIssue: ImportCashPreviewIssue | null;
};

type CashEvent = {
  date: string;
  effectiveTime: string;
  sourceOrder: number;
  createdAt: string;
  id: string;
  order: number;
  currency: string;
  delta: number;
  type: TransactionType;
  amount: number;
  description: string;
  rowIndex: number | null;
};

const EPSILON = 0.005;

function addDelta(map: Map<string, number>, currency: string, delta: number) {
  map.set(currency, (map.get(currency) ?? 0) + delta);
}

function cashDeltasForTransaction(tx: Pick<Transaction, 'type' | 'amount' | 'currency' | 'target_amount' | 'target_currency'>): Array<{ currency: string; delta: number }> {
  const currency = (tx.currency ?? 'EUR').toUpperCase();
  const amount = Number(tx.amount) || 0;
  const deltas: Array<{ currency: string; delta: number }> = [];

  switch (tx.type) {
    case 'DEPOSIT':
    case 'DIVIDEND':
    case 'INTEREST':
    case 'SELL':
      deltas.push({ currency, delta: amount });
      break;
    case 'WITHDRAWAL':
    case 'BUY':
    case 'FEE':
    case 'CONVERSION':
      deltas.push({ currency, delta: -amount });
      break;
  }

  if (tx.type === 'CONVERSION' && tx.target_currency && tx.target_amount) {
    deltas.push({
      currency: tx.target_currency.toUpperCase(),
      delta: Number(tx.target_amount) || 0,
    });
  }

  return deltas;
}

function eventForDelta(
  tx: Pick<Transaction, 'type' | 'amount' | 'currency' | 'description' | 'date'> & {
    created_at?: string;
    id?: string;
    time?: string | null;
  },
  delta: { currency: string; delta: number },
  sourceOrder: number,
  order: number,
  rowIndex: number | null
): CashEvent {
  return {
    date: tx.date,
    effectiveTime: effectiveTime({
      date: tx.date,
      type: tx.type,
      time: tx.time ?? null,
      created_at: tx.created_at ?? '',
      id: tx.id ?? '',
    }),
    sourceOrder,
    createdAt: tx.created_at ?? '',
    id: tx.id ?? '',
    order,
    currency: delta.currency,
    delta: delta.delta,
    type: tx.type,
    amount: Number(tx.amount) || 0,
    description: tx.description ?? '',
    rowIndex,
  };
}

function proposedToEvents(
  row: ProposedTransaction,
  rowIndex: number,
  accountCurrency: string
): CashEvent[] {
  const currency = (row.currency ?? accountCurrency).toUpperCase();
  const baseOrder = rowIndex * 3;
  const events: CashEvent[] = [];
  const fees = Number(row.fees) || 0;

  if (row.type !== 'FEE' && fees > 0) {
    const feeTx = {
      type: 'FEE' as const,
      amount: fees,
      currency,
      description: `Frais ${row.type}`,
      date: row.date,
      created_at: '',
    };
    events.push(eventForDelta(feeTx, { currency, delta: -fees }, 1, baseOrder, rowIndex));
  }

  const tx = {
    type: row.type,
    amount: row.amount,
    currency,
    target_amount: row.target_amount ?? null,
    target_currency: row.target_currency ?? null,
    description: row.description ?? '',
    date: row.date,
    created_at: '',
  };

  cashDeltasForTransaction(tx).forEach((delta, deltaIndex) => {
    events.push(eventForDelta(tx, delta, 1, baseOrder + 1 + deltaIndex, rowIndex));
  });

  return events;
}

export function buildImportCashPreview(
  existingTransactions: Transaction[],
  importRows: ProposedTransaction[],
  accountId: string,
  accountCurrency: string = 'EUR'
): ImportCashPreview {
  const normalizedAccountCurrency = accountCurrency.toUpperCase();
  const before = new Map<string, number>();
  const importDelta = new Map<string, number>();
  const events: CashEvent[] = [];

  existingTransactions
    .filter((tx) => tx.account_id === accountId)
    .forEach((tx, index) => {
      const deltas = cashDeltasForTransaction(tx);
      deltas.forEach((delta, deltaIndex) => {
        addDelta(before, delta.currency, delta.delta);
        events.push(eventForDelta(tx, delta, 0, index * 3 + deltaIndex, null));
      });
    });

  importRows.forEach((row, rowIndex) => {
    for (const event of proposedToEvents(row, rowIndex, normalizedAccountCurrency)) {
      addDelta(importDelta, event.currency, event.delta);
      events.push(event);
    }
  });

  const balances = new Map<string, number>();
  let firstIssue: ImportCashPreviewIssue | null = null;
  const ordered = [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.effectiveTime !== b.effectiveTime) {
      return a.effectiveTime.localeCompare(b.effectiveTime);
    }
    if (a.sourceOrder !== b.sourceOrder) return a.sourceOrder - b.sourceOrder;
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    if (a.id !== b.id) return a.id.localeCompare(b.id);
    return a.order - b.order;
  });

  for (const event of ordered) {
    const next = (balances.get(event.currency) ?? 0) + event.delta;
    balances.set(event.currency, next);

    if (!firstIssue && next < -EPSILON) {
      firstIssue = {
        currency: event.currency,
        date: event.date,
        balance: next,
        type: event.type,
        amount: event.amount,
        rowIndex: event.rowIndex,
        description: event.description,
      };
    }
  }

  const currencies = new Set<string>([
    ...before.keys(),
    ...importDelta.keys(),
    normalizedAccountCurrency,
  ]);

  const buckets = Array.from(currencies)
    .map((currency) => {
      const beforeValue = before.get(currency) ?? 0;
      const importDeltaValue = importDelta.get(currency) ?? 0;
      return {
        currency,
        before: beforeValue,
        importDelta: importDeltaValue,
        after: beforeValue + importDeltaValue,
      };
    })
    .filter((bucket) =>
      Math.abs(bucket.before) > 0.0001 ||
      Math.abs(bucket.importDelta) > 0.0001 ||
      Math.abs(bucket.after) > 0.0001
    )
    .sort((a, b) => a.currency.localeCompare(b.currency));

  return { buckets, firstIssue };
}
