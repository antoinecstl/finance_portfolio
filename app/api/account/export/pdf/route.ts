import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  calculateAllPositionsAtDate,
  calculateAccountCashFromTransactions,
} from '@/lib/portfolio-calculator';
import type { Account, Transaction } from '@/lib/types';

// Rapport PDF : couverture + synthèse portefeuille + détail comptes + dernières transactions.
// Utilise jsPDF (pas de puppeteer) → rapide, serverless-friendly.
// Le query param ?period=month|quarter|year|all filtre les transactions affichées.

const PERIOD_DAYS: Record<string, number | null> = {
  month: 30,
  quarter: 90,
  year: 365,
  all: null,
};

function fmtEUR(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR').format(new Date(d));
}

const TX_LABEL: Record<string, string> = {
  DEPOSIT: 'Dépôt', WITHDRAWAL: 'Retrait', BUY: 'Achat', SELL: 'Vente',
  DIVIDEND: 'Dividende', INTEREST: 'Intérêts', FEE: 'Frais',
};

const ACC_LABEL: Record<string, string> = {
  PEA: 'PEA', LIVRET_A: 'Livret A', LDDS: 'LDDS', CTO: 'Compte-Titres',
  ASSURANCE_VIE: 'Assurance Vie', PEL: 'PEL', AUTRE: 'Autre',
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

  const accounts: Account[] = accountsRes.data ?? [];
  const allTransactions: Transaction[] = txRes.data ?? [];

  // Filtre par fenêtre temporelle
  const cutoffDate = daysWindow
    ? new Date(Date.now() - daysWindow * 86400_000).toISOString().split('T')[0]
    : null;
  const transactions = cutoffDate
    ? allTransactions.filter((t) => t.date >= cutoffDate)
    : allTransactions;

  const today = new Date().toISOString().split('T')[0];

  // Calcul des positions actuelles
  const positionsMap = calculateAllPositionsAtDate(allTransactions, today);

  // Calcul de la valeur par compte (cash = transactions replay)
  const accountValues = accounts.map((acc) => {
    const cash = calculateAccountCashFromTransactions(allTransactions, acc.id);
    return { account: acc, cash };
  });

  const totalCash = accountValues.reduce((sum, a) => sum + a.cash, 0);
  // Valeur actions à PRU (faute de quotes dans un contexte SSR sans appel Yahoo synchrone).
  let totalStocksAtPRU = 0;
  positionsMap.forEach((pos) => {
    totalStocksAtPRU += pos.quantity * pos.averagePrice;
  });
  const totalPortfolio = totalCash + totalStocksAtPRU;

  // Agrégats sur la période
  const aggByType: Record<string, { count: number; amount: number }> = {};
  for (const t of transactions) {
    aggByType[t.type] = aggByType[t.type] ?? { count: 0, amount: 0 };
    aggByType[t.type].count++;
    aggByType[t.type].amount += Number(t.amount) || 0;
  }

  // ====== PDF ======
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Couverture
  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(0, 0, pageWidth, 120, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text('Rapport Patrimoine', 40, 60);
  doc.setFontSize(12);
  doc.text(`fi-hub — ${user.email ?? user.id}`, 40, 85);
  doc.text(`Généré le ${fmtDate(new Date())}`, 40, 105);

  doc.setTextColor(0, 0, 0);
  let cursorY = 160;

  // Section : synthèse
  doc.setFontSize(14);
  doc.text('Synthèse patrimoniale', 40, cursorY);
  cursorY += 10;

  autoTable(doc, {
    startY: cursorY + 5,
    head: [['Indicateur', 'Valeur']],
    body: [
      ['Valeur totale du portefeuille', fmtEUR(totalPortfolio)],
      ['Cash disponible (tous comptes)', fmtEUR(totalCash)],
      ['Valeur des actions (au PRU)', fmtEUR(totalStocksAtPRU)],
      ['Nombre de comptes', String(accounts.length)],
      ['Nombre de positions actives', String(positionsMap.size)],
      ['Nombre total de transactions', String(allTransactions.length)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 10 },
    margin: { left: 40, right: 40 },
  });

  // @ts-expect-error autoTable modifie la référence interne
  cursorY = doc.lastAutoTable.finalY + 25;

  // Section : détail des comptes
  if (accountValues.length > 0) {
    doc.setFontSize(14);
    doc.text('Détail des comptes', 40, cursorY);
    cursorY += 5;

    autoTable(doc, {
      startY: cursorY + 5,
      head: [['Compte', 'Type', 'Cash', 'Devise']],
      body: accountValues.map(({ account, cash }) => [
        account.name,
        ACC_LABEL[account.type] ?? account.type,
        fmtEUR(cash),
        account.currency,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 10 },
      margin: { left: 40, right: 40 },
    });

    // @ts-expect-error autoTable
    cursorY = doc.lastAutoTable.finalY + 25;
  }

  // Section : positions actuelles
  if (positionsMap.size > 0) {
    if (cursorY > 700) {
      doc.addPage();
      cursorY = 40;
    }
    doc.setFontSize(14);
    doc.text('Positions actuelles', 40, cursorY);
    cursorY += 5;

    const rows = Array.from(positionsMap.values()).map((pos) => [
      pos.symbol,
      pos.quantity.toFixed(4),
      fmtEUR(pos.averagePrice),
      fmtEUR(pos.totalInvested),
    ]);

    autoTable(doc, {
      startY: cursorY + 5,
      head: [['Symbole', 'Quantité', 'PRU', 'Montant investi']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 10 },
      margin: { left: 40, right: 40 },
    });

    // @ts-expect-error autoTable
    cursorY = doc.lastAutoTable.finalY + 25;
  }

  // Section : activité sur la période
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
    head: [['Type', 'Nombre', 'Montant cumulé']],
    body: Object.entries(aggByType).map(([type, v]) => [
      TX_LABEL[type] ?? type,
      String(v.count),
      fmtEUR(v.amount),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 10 },
    margin: { left: 40, right: 40 },
  });

  // @ts-expect-error autoTable
  cursorY = doc.lastAutoTable.finalY + 25;

  // Table des transactions de la période (max 100 pour rester lisible)
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

    const rows = transactions.slice(0, 100).map((t) => {
      const acc = accounts.find((a) => a.id === t.account_id);
      return [
        fmtDate(t.date),
        TX_LABEL[t.type] ?? t.type,
        acc?.name ?? '—',
        t.stock_symbol ?? '—',
        fmtEUR(Number(t.amount) || 0),
      ];
    });

    autoTable(doc, {
      startY: cursorY + 5,
      head: [['Date', 'Type', 'Compte', 'Symbole', 'Montant']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });
  }

  // Footer sur toutes les pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
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
