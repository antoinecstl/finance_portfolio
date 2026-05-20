import Image from 'next/image';
import {
  AlertTriangle,
  Check,
  FileSpreadsheet,
  Sparkles,
  Upload,
  Wallet,
} from 'lucide-react';

type FeatureMockupProps = {
  slug: string;
};

const importRows = [
  { date: '12/05', type: 'BUY', symbol: 'CW8.PA', qty: '4', amount: '1 742,80 €', status: 'Mappé' },
  { date: '08/05', type: 'DIV', symbol: 'AIR.PA', qty: '-', amount: '46,20 €', status: 'Mappé' },
  { date: '03/05', type: 'BUY', symbol: 'MC.PA', qty: '1', amount: '651,40 €', status: 'À vérifier' },
];

function ProductScreenshot({
  title,
  subtitle,
  src,
  alt,
  width,
  height,
  maxHeight,
}: {
  title: string;
  subtitle: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  maxHeight?: number;
}) {
  return (
    <section className="mt-10 overflow-hidden rounded-2xl border border-[color:var(--rule)] bg-[color:var(--paper)] shadow-xl">
      <div className="flex items-center justify-between gap-4 border-b border-[color:var(--rule)] px-4 py-3">
        <div>
          <p className="mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--ink-soft)]">
            Capture produit
          </p>
          <h2 className="mt-1 text-sm font-semibold text-[color:var(--ink)]">{title}</h2>
        </div>
        <span className="rounded-full border border-[color:var(--rule)] px-2.5 py-1 text-[10px] text-[color:var(--ink-soft)]">
          Fi-Hub
        </span>
      </div>
      <div className="bg-[color:var(--paper-2)] p-3 sm:p-4">
        <p className="mb-3 text-xs text-[color:var(--ink-soft)]">{subtitle}</p>
        <div
          className="overflow-hidden rounded-xl border border-[color:var(--rule)] bg-[color:var(--paper)]"
          style={maxHeight ? { maxHeight } : undefined}
        >
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            sizes="(max-width: 768px) 100vw, 900px"
            className="h-auto w-full"
          />
        </div>
      </div>
    </section>
  );
}

function MockupShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-950 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <p className="mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Aperçu produit</p>
          <h2 className="mt-1 text-sm font-semibold">{title}</h2>
        </div>
        <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-[10px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Données fictives
        </span>
      </div>
      <div className="bg-zinc-50 p-4 dark:bg-zinc-950 sm:p-5">
        <p className="mb-4 text-xs text-zinc-500">{subtitle}</p>
        {children}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'warning';
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-700 dark:text-emerald-300'
      : tone === 'warning'
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-zinc-950 dark:text-zinc-100';

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function ImportMockup() {
  return (
    <MockupShell
      title="Preview d’import"
      subtitle="L’IA prépare les lignes, puis le wizard conserve la validation ligne par ligne avant l’écriture définitive des transactions."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <FileSpreadsheet className="h-4 w-4" />
            releve_bourse_direct_mai.csv
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
            <Sparkles className="h-4 w-4" />
            Analyse IA
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 text-xs text-white">
          <Upload className="h-4 w-4" />
          3 lignes extraites
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900 dark:border-violet-800 dark:bg-violet-950/35 dark:text-violet-100">
        <div className="flex items-center gap-2 font-medium">
          <Sparkles className="h-4 w-4" />
          Extraction IA : 3 opérations détectées, 2 tickers reconnus, 1 ligne à vérifier
        </div>
        <p className="mt-2 text-xs leading-relaxed text-violet-700 dark:text-violet-200/80">
          Les propositions restent éditables avant validation : type, ticker, montant, devise et frais.
        </p>
      </div>
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
        <div className="flex items-center gap-2 font-medium">
          <Wallet className="h-4 w-4" />
          Trésorerie projetée après import
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Metric label="Avant import" value="5 120,40 €" />
          <Metric label="Impact import" value="-2 347,20 €" tone="warning" />
          <Metric label="Après import" value="2 773,20 €" tone="positive" />
        </div>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[38rem] text-sm">
          <thead className="bg-zinc-100 text-left text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Symbole</th>
              <th className="px-4 py-3 font-medium text-right">Qté</th>
              <th className="px-4 py-3 font-medium text-right">Montant</th>
              <th className="px-4 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-zinc-950">
            {importRows.map((row) => {
              const warning = row.status !== 'Mappé';
              return (
                <tr key={`${row.date}-${row.symbol}`} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{row.date}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-zinc-100 px-2 py-1 text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {row.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-950 dark:text-zinc-100">{row.symbol}</td>
                  <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">{row.qty}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-950 dark:text-zinc-100">
                    {row.amount}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 text-xs ${
                        warning
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {warning ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      {row.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </MockupShell>
  );
}

export function FeatureMockup({ slug }: FeatureMockupProps) {
  if (slug === 'positions-pru') {
    return (
      <ProductScreenshot
        title="Onglet Positions"
        subtitle="Capture de la page positions : filtres de comptes, PRU, performances, détail des lignes et historique."
        src="/Page_Position.png"
        alt="Capture de la page Positions Fi-Hub avec PRU, performances et détail des lignes"
        width={1920}
        height={4588}
        maxHeight={900}
      />
    );
  }

  if (slug === 'dividendes') {
    return (
      <ProductScreenshot
        title="Onglet Dividendes"
        subtitle="Capture de la page dividendes avec résumé, évolution annuelle, rendement sur coût et historique."
        src="/Dividende_page.png"
        alt="Capture de la page Dividendes Fi-Hub avec tableau par action et historique"
        width={1920}
        height={1952}
      />
    );
  }

  if (slug === 'benchmark') {
    return (
      <ProductScreenshot
        title="Benchmark portefeuille"
        subtitle="Capture du module benchmark : portefeuille hors apports comparé à un indice de référence."
        src="/Benchmark_vue.png"
        alt="Capture du benchmark Fi-Hub comparant le portefeuille à un indice"
        width={1520}
        height={593}
      />
    );
  }

  if (slug === 'import-transactions') return <ImportMockup />;

  return (
    <MockupShell
      title="Aperçu Fi-Hub"
      subtitle="Exemple d’écran produit avec données fictives."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Patrimoine" value="142 580 €" />
        <Metric label="Performance" value="+12,4%" tone="positive" />
        <Metric label="Transactions" value="128" />
      </div>
      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        Vue de démonstration
      </div>
    </MockupShell>
  );
}
