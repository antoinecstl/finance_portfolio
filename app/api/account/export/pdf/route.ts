import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  calculateAllPositionsAtDate,
  calculateAccountCashByCurrencyAtDate,
} from '@/lib/portfolio-calculator';
import { compareTransactionSequence } from '@/lib/transaction-ordering';
import { formatCurrency, formatCurrencyBreakdown } from '@/lib/utils';
import type { Account, Transaction } from '@/lib/types';

const PERIOD_DAYS: Record<string, number | null> = {
  month: 30,
  quarter: 90,
  year: 365,
  all: null,
};

type CurrencyBuckets = Record<string, number>;

const BUCKET_EPSILON = 0.0001;

function normalizeCurrency(currency?: string | null): string {
  return (currency || 'EUR').toUpperCase();
}

function addBucket(
  buckets: CurrencyBuckets,
  currency: string | null | undefined,
  amount: number
): void {
  if (!Number.isFinite(amount) || Math.abs(amount) <= BUCKET_EPSILON) return;
  const normalized = normalizeCurrency(currency);
  const next = (buckets[normalized] ?? 0) + amount;
  if (Math.abs(next) <= BUCKET_EPSILON) {
    delete buckets[normalized];
  } else {
    buckets[normalized] = next;
  }
}

function mergeBuckets(...bucketList: CurrencyBuckets[]): CurrencyBuckets {
  const result: CurrencyBuckets = {};
  for (const buckets of bucketList) {
    for (const [currency, amount] of Object.entries(buckets)) {
      addBucket(result, currency, amount);
    }
  }
  return result;
}

function mapToBuckets(cashByCurrency: Map<string, number>): CurrencyBuckets {
  const result: CurrencyBuckets = {};
  cashByCurrency.forEach((amount, currency) => addBucket(result, currency, amount));
  return result;
}

function formatBuckets(buckets: CurrencyBuckets, fallbackCurrency = 'EUR'): string {
  return formatCurrencyBreakdown(buckets, fallbackCurrency);
}

function fmtDate(d: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR').format(new Date(d));
}

function transactionCashBuckets(tx: Transaction): CurrencyBuckets {
  const buckets: CurrencyBuckets = {};
  const amount = Number(tx.amount) || 0;

  switch (tx.type) {
    case 'DEPOSIT':
    case 'DIVIDEND':
    case 'INTEREST':
    case 'SELL':
      addBucket(buckets, tx.currency, amount);
      break;
    case 'WITHDRAWAL':
    case 'BUY':
    case 'FEE':
    case 'CONVERSION':
      addBucket(buckets, tx.currency, -amount);
      break;
  }

  if (tx.type === 'CONVERSION' && tx.target_currency && tx.target_amount) {
    addBucket(buckets, tx.target_currency, Number(tx.target_amount));
  }

  return buckets;
}

function formatTransactionMovement(tx: Transaction): string {
  return formatBuckets(transactionCashBuckets(tx), normalizeCurrency(tx.currency));
}

function buildPositionCurrencyMap(transactions: Transaction[]): Map<string, string> {
  const stateByKey = new Map<string, { quantity: number; currency?: string }>();
  for (const tx of [...transactions].sort(compareTransactionSequence)) {
    if (!tx.stock_symbol || (tx.type !== 'BUY' && tx.type !== 'SELL')) continue;
    const key = `${tx.account_id}:${tx.stock_symbol.toUpperCase()}`;
    const state = stateByKey.get(key) ?? { quantity: 0 };
    const qty = Number(tx.quantity) || 0;

    if (tx.type === 'BUY') {
      if (state.quantity <= 0 || !state.currency) {
        state.currency = normalizeCurrency(tx.currency);
      }
      state.quantity += qty;
    } else {
      state.quantity -= qty;
      if (state.quantity <= 0) {
        state.quantity = 0;
        state.currency = undefined;
      }
    }

    stateByKey.set(key, state);
  }

  const result = new Map<string, string>();
  stateByKey.forEach((state, key) => {
    if (state.currency) result.set(key, state.currency);
  });
  return result;
}

const TX_LABEL: Record<string, string> = {
  DEPOSIT: 'Dépôt',
  WITHDRAWAL: 'Retrait',
  BUY: 'Achat',
  SELL: 'Vente',
  DIVIDEND: 'Dividende',
  INTEREST: 'Intérêts',
  FEE: 'Frais',
  CONVERSION: 'Conversion',
};

const ACC_LABEL: Record<string, string> = {
  PEA: 'PEA',
  LIVRET_A: 'Livret A',
  LDDS: 'LDDS',
  CTO: 'Compte-Titres',
  ASSURANCE_VIE: 'Assurance Vie',
  PEL: 'PEL',
  CRYPTO: 'Crypto',
  AUTRE: 'Autre',
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const period = request.nextUrl.searchParams.get('period') ?? 'month';
  const daysWindow = period in PERIOD_DAYS ? PERIOD_DAYS[period] : 30;

  const [accountsRes, txRes] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', user.id),
    supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }),
  ]);

  if (accountsRes.error || txRes.error) {
    console.error('[api/account/export/pdf] fetch failed', accountsRes.error ?? txRes.error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  const accounts: Account[] = accountsRes.data ?? [];
  const allTransactions: Transaction[] = txRes.data ?? [];
  const accountsById = new Map(accounts.map((account) => [account.id, account]));

  const cutoffDate = daysWindow
    ? new Date(Date.now() - daysWindow * 86400_000).toISOString().split('T')[0]
    : null;
  const transactions = cutoffDate
    ? allTransactions.filter((t) => t.date >= cutoffDate)
    : allTransactions;

  const today = new Date().toISOString().split('T')[0];
  const positionsMap = calculateAllPositionsAtDate(allTransactions, today);
  const positionCurrencyByKey = buildPositionCurrencyMap(allTransactions);

  const totalStocksAtPRUByCurrency: CurrencyBuckets = {};
  const positionRows = Array.from(positionsMap.entries()).map(([key, pos]) => {
    const account = accountsById.get(pos.accountId);
    const currency = positionCurrencyByKey.get(key) ?? normalizeCurrency(account?.currency);
    addBucket(totalStocksAtPRUByCurrency, currency, pos.totalInvested);

    return {
      accountId: pos.accountId,
      accountName: account?.name ?? '—',
      symbol: pos.symbol,
      quantity: pos.quantity,
      averagePrice: pos.averagePrice,
      totalInvested: pos.totalInvested,
      currency,
    };
  });

  const accountValues = accounts.map((account) => {
    const cashByCurrency = mapToBuckets(
      calculateAccountCashByCurrencyAtDate(allTransactions, account.id, today)
    );
    const stocksByCurrency: CurrencyBuckets = {};
    for (const row of positionRows) {
      if (row.accountId === account.id) {
        addBucket(stocksByCurrency, row.currency, row.totalInvested);
      }
    }

    return {
      account,
      cashByCurrency,
      stocksByCurrency,
      totalByCurrency: mergeBuckets(cashByCurrency, stocksByCurrency),
    };
  });

  const totalCashByCurrency = mergeBuckets(
    ...accountValues.map((value) => value.cashByCurrency)
  );
  const totalPortfolioByCurrency = mergeBuckets(
    totalCashByCurrency,
    totalStocksAtPRUByCurrency
  );

  const aggByType: Record<string, { count: number; buckets: CurrencyBuckets }> = {};
  for (const t of transactions) {
    aggByType[t.type] = aggByType[t.type] ?? { count: 0, buckets: {} };
    aggByType[t.type].count++;
    aggByType[t.type].buckets = mergeBuckets(
      aggByType[t.type].buckets,
      transactionCashBuckets(t)
    );
  }

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const PDF_INK: [number, number, number] = [14, 12, 10];
  const PDF_PAPER: [number, number, number] = [247, 242, 232];
  const PDF_ACCENT: [number, number, number] = [185, 28, 28];
  const PDF_MUTED: [number, number, number] = [91, 82, 74];

  doc.setFillColor(...PDF_ACCENT);
  doc.rect(0, 0, pageWidth, 120, 'F');
  doc.setTextColor(...PDF_PAPER);
  doc.setFontSize(24);
  doc.text('Rapport Patrimoine', 40, 60);
  doc.setFontSize(12);
  doc.text(`fi-hub — ${user.email ?? user.id}`, 40, 85);
  doc.text(`Généré le ${fmtDate(new Date())}`, 40, 105);

  doc.setTextColor(...PDF_INK);
  let cursorY = 160;

  doc.setFontSize(14);
  doc.text('Synthèse patrimoniale', 40, cursorY);
  cursorY += 10;

  autoTable(doc, {
    startY: cursorY + 5,
    head: [['Indicateur', 'Valeur']],
    body: [
      ['Valeur totale du portefeuille', formatBuckets(totalPortfolioByCurrency)],
      ['Cash disponible (tous comptes)', formatBuckets(totalCashByCurrency)],
      ['Valeur des actions (au PRU)', formatBuckets(totalStocksAtPRUByCurrency)],
      ['Nombre de comptes', String(accounts.length)],
      ['Nombre de positions actives', String(positionsMap.size)],
      ['Nombre total de transactions', String(allTransactions.length)],
    ],
    theme: 'striped',
    headStyles: { fillColor: PDF_ACCENT },
    styles: { fontSize: 10 },
    margin: { left: 40, right: 40 },
  });

  // @ts-expect-error autoTable mutates the jsPDF instance.
  cursorY = doc.lastAutoTable.finalY + 25;

  if (accountValues.length > 0) {
    doc.setFontSize(14);
    doc.text('Détail des comptes', 40, cursorY);
    cursorY += 5;

    autoTable(doc, {
      startY: cursorY + 5,
      head: [['Compte', 'Type', 'Cash', 'Positions (PRU)', 'Total']],
      body: accountValues.map(({ account, cashByCurrency, stocksByCurrency, totalByCurrency }) => [
        account.name,
        ACC_LABEL[account.type] ?? account.type,
        formatBuckets(cashByCurrency, account.currency),
        formatBuckets(stocksByCurrency, account.currency),
        formatBuckets(totalByCurrency, account.currency),
      ]),
      theme: 'striped',
      headStyles: { fillColor: PDF_ACCENT },
      styles: { fontSize: 10 },
      margin: { left: 40, right: 40 },
    });

    // @ts-expect-error autoTable mutates the jsPDF instance.
    cursorY = doc.lastAutoTable.finalY + 25;
  }

  if (positionRows.length > 0) {
    if (cursorY > 700) {
      doc.addPage();
      cursorY = 40;
    }
    doc.setFontSize(14);
    doc.text('Positions actuelles', 40, cursorY);
    cursorY += 5;

    autoTable(doc, {
      startY: cursorY + 5,
      head: [['Compte', 'Symbole', 'Quantité', 'Devise', 'PRU', 'Montant investi']],
      body: positionRows.map((pos) => [
        pos.accountName,
        pos.symbol,
        pos.quantity.toFixed(4),
        pos.currency,
        formatCurrency(pos.averagePrice, pos.currency),
        formatCurrency(pos.totalInvested, pos.currency),
      ]),
      theme: 'striped',
      headStyles: { fillColor: PDF_ACCENT },
      styles: { fontSize: 10 },
      margin: { left: 40, right: 40 },
    });

    // @ts-expect-error autoTable mutates the jsPDF instance.
    cursorY = doc.lastAutoTable.finalY + 25;
  }

  doc.addPage();
  cursorY = 40;
  doc.setFontSize(14);
  const periodLabel = period === 'all' ? 'depuis le début' :
    period === 'month' ? 'sur le mois écoulé' :
    period === 'quarter' ? 'sur le trimestre écoulé' : 'sur l\'année écoulée';
  doc.text(`Activité ${periodLabel}`, 40, cursorY);
  cursorY += 5;

  autoTable(doc, {
    startY: cursorY + 5,
    head: [['Type', 'Nombre', 'Mouvement cash cumulé']],
    body: Object.entries(aggByType).map(([type, value]) => [
      TX_LABEL[type] ?? type,
      String(value.count),
      formatBuckets(value.buckets),
    ]),
    theme: 'striped',
    headStyles: { fillColor: PDF_ACCENT },
    styles: { fontSize: 10 },
    margin: { left: 40, right: 40 },
  });

  // @ts-expect-error autoTable mutates the jsPDF instance.
  cursorY = doc.lastAutoTable.finalY + 25;

  if (transactions.length > 0) {
    if (cursorY > 700) {
      doc.addPage();
      cursorY = 40;
    }
    doc.setFontSize(12);
    doc.text(
      `Liste des transactions (${transactions.length > 100 ? 'les 100 plus récentes' : transactions.length})`,
      40,
      cursorY
    );
    cursorY += 5;

    autoTable(doc, {
      startY: cursorY + 5,
      head: [['Date', 'Type', 'Compte', 'Symbole', 'Montant / mouvement']],
      body: transactions.slice(0, 100).map((t) => {
        const acc = accountsById.get(t.account_id);
        return [
          fmtDate(t.date),
          TX_LABEL[t.type] ?? t.type,
          acc?.name ?? '—',
          t.stock_symbol ?? '—',
          formatTransactionMovement(t),
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: PDF_ACCENT },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(...PDF_MUTED);
    doc.text(
      `fi-hub — page ${i} / ${totalPages}`,
      pageWidth - 40,
      doc.internal.pageSize.getHeight() - 20,
      { align: 'right' }
    );
  }

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  const filename = `fi-hub-rapport-${period}-${today}.pdf`;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
    },
  });
}
