'use client';

// Valeur d'une action par actualisation de ses flux de trésorerie (DCF), lue en
// trois temps : ce que le cours anticipe, trois scénarios pré-remplis à partir
// des comptes, puis des hypothèses ajustables (docs/specs/explorateur-marches-v2.md §4.3).

import { useMemo, useState } from 'react';
import { impliedGrowth, type DcfPlan, type DcfScenario } from '@/lib/market/dcf';
import { dcfValuePerShare } from '@/lib/market/fundamentals';
import { changeClass, fmtPct, fmtPrice, fmtShare } from './format';
import { Panel } from './ui';

const SCENARIOS: Array<{ key: DcfScenario; label: string }> = [
  { key: 'prudent', label: 'Prudent' },
  { key: 'central', label: 'Central' },
  { key: 'optimistic', label: 'Optimiste' },
];

/** Hypothèses au demi-point : « +7 % », « +7,5 % ». */
const digitsOf = (v: number) => (Math.round(v * 1000) % 10 === 0 ? 0 : 1);
const pctLabel = (v: number) => fmtPct(v, digitsOf(v));
const rate = (v: number) => fmtShare(v, digitsOf(v));
const subtitle = 'text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400';

// Champ en pourcentage saisi comme du texte : on peut effacer le champ, taper
// « 7,5 » avec une virgule, et la valeur n'est transmise que si elle est lisible.
function PercentInput({ id, label, value, onChange, hint }: { id: string; label: string; value: number; onChange: (v: number) => void; hint: string }) {
  const [text, setText] = useState(() => (Number.isFinite(value) ? String(Math.round(value * 1000) / 10).replace('.', ',') : ''));
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      <div className="mt-1 flex max-w-[8rem] items-center gap-1">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(e) => {
            const next = e.target.value.replace(/[^\d,.-]/g, '').slice(0, 6);
            setText(next);
            const n = Number(next.replace(',', '.'));
            if (next.trim() !== '' && Number.isFinite(n) && n >= -50 && n <= 100) onChange(n / 100);
          }}
          aria-describedby={`${id}-hint`}
          className="w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm tabular-nums text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <span className="shrink-0 text-sm text-zinc-500">%</span>
      </div>
      <p id={`${id}-hint`} className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{hint}</p>
    </div>
  );
}

/** Croissances qui fondent le scénario central, en une phrase. */
function basisSentence(basis: DcfPlan['basis']): string | null {
  const past = [
    basis.revenueCagr !== null ? `chiffre d’affaires ${fmtPct(basis.revenueCagr, 1)}` : null,
    basis.epsCagr !== null ? `BPA ${fmtPct(basis.epsCagr, 1)}` : null,
    basis.fcfCagr !== null ? `free cash flow ${fmtPct(basis.fcfCagr, 1)}` : null,
  ].filter(Boolean);
  const parts = [
    past.length > 0 ? `${basis.growthYears ? `ces ${basis.growthYears} dernières années` : 'ces dernières années'}, ${past.join(', ')} par an` : null,
    basis.analystGrowth !== null ? `analystes : ${fmtPct(basis.analystGrowth, 1)} par an attendus sur 5 ans` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `Repères : ${parts.join(' ; ')}.` : null;
}

function verdict(implied: NonNullable<ReturnType<typeof impliedGrowth>>, central: number): string {
  if (implied.bound === 'above') {
    return 'Le cours suppose plus de 60 % de croissance par an : il repose sur des attentes très élevées, ou le free cash flow récent est exceptionnellement bas.';
  }
  if (implied.bound === 'below') {
    return 'Le cours suppose un recul durable du free cash flow : le marché doute fortement de l’activité, ou le free cash flow récent est exceptionnellement haut.';
  }
  const ref = `le scénario central (${pctLabel(central)} par an)`;
  if (implied.growth > central + 0.03) return `C’est plus que ${ref} : le cours intègre déjà une accélération.`;
  if (implied.growth < central - 0.03) return `C’est moins que ${ref} : le cours suppose un ralentissement.`;
  return `C’est proche du ${ref.replace('le ', '')} : le cours est cohérent avec la tendance.`;
}

export function DcfPanel({
  plan, fcfPerShare, price, currency, priceCurrency, sector,
}: {
  plan: DcfPlan;
  fcfPerShare: number | null;
  /** Cours dans la devise des comptes. */
  price: number | null;
  currency: string;
  priceCurrency: string;
  sector: string | null;
}) {
  const central = plan.scenarios.central;
  const [growth, setGrowth] = useState(central.growth);
  const [discount, setDiscount] = useState(central.discountRate);
  const [terminal, setTerminal] = useState(central.terminalGrowth);
  const custom = useMemo(
    () => (fcfPerShare !== null ? dcfValuePerShare({ fcfPerShare, growth, discountRate: discount, terminalGrowth: terminal }) : null),
    [fcfPerShare, growth, discount, terminal]
  );

  const valid = fcfPerShare !== null && fcfPerShare > 0;
  const implied = valid && price ? impliedGrowth({ fcfPerShare, price, discountRate: central.discountRate, terminalGrowth: central.terminalGrowth }) : null;
  const gap = (v: number | null) => (v !== null && price ? v / price - 1 : null);
  const financial = sector !== null && /financ|bank|banque|assur|insurance/i.test(sector);
  const otherCurrency = priceCurrency && priceCurrency.toUpperCase() !== currency.toUpperCase();
  const basis = basisSentence(plan.basis);
  const discounted100 = 100 / Math.pow(1 + central.discountRate, 10);

  return (
    <Panel
      id="dcf"
      title="Valeur selon les flux de trésorerie (DCF)"
      description="Une entreprise vaut l’argent qu’elle produira, ramené à sa valeur d’aujourd’hui."
    >
      {!valid ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Free cash flow négatif ou inconnu sur 12 mois : la méthode n’a pas de sens ici.
        </p>
      ) : (
        <div className="space-y-5">
          {implied && price && (
            <div className="rounded-lg bg-zinc-50 px-3 py-3 dark:bg-zinc-800/60">
              <h3 className={subtitle}>Ce que le cours anticipe</h3>
              <p className="mt-1.5 text-sm text-zinc-900 dark:text-zinc-100">
                Le cours actuel ({fmtPrice(price, currency)}) correspond à un free cash flow qui{' '}
                <span className="font-semibold">
                  {implied.bound === 'above'
                    ? 'progresse de plus de 60 % par an'
                    : implied.bound === 'below'
                      ? 'recule de plus de 30 % par an'
                      : implied.growth >= 0
                        ? `progresse d’environ ${fmtShare(implied.growth, 0)} par an`
                        : `recule d’environ ${fmtShare(-implied.growth, 0)} par an`}
                </span>{' '}
                pendant 5 ans.
              </p>
              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{verdict(implied, central.growth)}</p>
              {basis && <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{basis}</p>}
            </div>
          )}

          <div>
            <h3 className={subtitle}>Trois scénarios</h3>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  <th scope="col" className="py-1.5 pr-2 text-left font-medium">Scénario</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">Croissance</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">Valeur</th>
                  <th scope="col" className="py-1.5 pl-2 text-right font-medium">vs cours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 tabular-nums dark:divide-zinc-800">
                {SCENARIOS.map(({ key, label }) => {
                  const s = plan.scenarios[key];
                  const value = dcfValuePerShare({ fcfPerShare, growth: s.growth, discountRate: s.discountRate, terminalGrowth: s.terminalGrowth });
                  const g = gap(value);
                  return (
                    <tr key={key} className={key === 'central' ? 'font-semibold' : 'font-normal'}>
                      <th scope="row" className={`py-1.5 pr-2 text-left text-zinc-700 dark:text-zinc-300 ${key === 'central' ? 'font-semibold' : 'font-normal'}`}>{label}</th>
                      <td className="px-2 py-1.5 text-right text-zinc-900 dark:text-zinc-100">{pctLabel(s.growth)} / an</td>
                      <td className="px-2 py-1.5 text-right text-zinc-900 dark:text-zinc-100">{fmtPrice(value, currency)}</td>
                      <td className={`py-1.5 pl-2 text-right ${changeClass(g)}`}>{g !== null ? fmtPct(g, 0) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Croissance du free cash flow sur 5 ans, puis ralentissement jusqu’à {rate(central.terminalGrowth)} par an.
              Rendement exigé : {rate(central.discountRate)}{plan.basis.beta !== null ? ` (bêta ${plan.basis.beta.toFixed(2).replace('.', ',')})` : ''}.
              Le scénario central reprend la croissance médiane {plan.basis.analystGrowth !== null ? 'passée et attendue' : 'des dernières années'}, bornée entre 0 et 15 %.
              {otherCurrency ? ` Montants en ${currency}, devise des comptes.` : ''}
            </p>
          </div>

          <details className="group rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700">
            <summary className="cursor-pointer select-none text-sm font-medium text-zinc-800 dark:text-zinc-200">Ajuster les hypothèses</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <PercentInput
                id="dcf-growth"
                label="Croissance des 5 prochaines années"
                value={growth}
                onChange={setGrowth}
                hint="Progression annuelle du free cash flow, qui ralentit ensuite jusqu’à la croissance à long terme."
              />
              <PercentInput
                id="dcf-discount"
                label="Rendement exigé"
                value={discount}
                onChange={setDiscount}
                hint={`Ce que vous attendez de l’action par an. Plus il est haut, plus la valeur baisse. ${rate(central.discountRate)} proposé d’après la volatilité du titre.`}
              />
              <PercentInput
                id="dcf-terminal"
                label="Croissance à long terme"
                value={terminal}
                onChange={setTerminal}
                hint="Rythme durable après 10 ans, proche de l’inflation. Doit rester sous le rendement exigé."
              />
            </div>
            <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60" aria-live="polite">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Votre scénario : valeur par action</p>
              <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {custom !== null ? fmtPrice(custom, currency) : '—'}
                {gap(custom) !== null && <span className={`ml-2 text-sm font-medium ${changeClass(gap(custom))}`}>{fmtPct(gap(custom), 0)} vs cours</span>}
              </p>
              {custom === null && <p className="text-xs text-zinc-500">Le rendement exigé doit dépasser la croissance à long terme.</p>}
            </div>
          </details>

          <details className="text-xs text-zinc-600 dark:text-zinc-400">
            <summary className="cursor-pointer select-none font-medium text-zinc-700 dark:text-zinc-300">Comment ça marche</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4 leading-relaxed">
              <li>Point de départ : le free cash flow par action des 12 derniers mois ({fmtPrice(fcfPerShare, currency)}), l’argent qui reste une fois les investissements payés.</li>
              <li>Il progresse 5 ans au rythme choisi, ralentit jusqu’à la croissance à long terme la 10ᵉ année, puis garde ce rythme.</li>
              <li>
                Chaque flux futur est ramené à aujourd’hui avec le rendement exigé : à {rate(central.discountRate)}, 100 {currency} reçus dans 10 ans
                valent {new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(discounted100)} {currency} aujourd’hui.
              </li>
              <li>La somme donne une valeur par action. Elle est très sensible aux hypothèses : c’est un ordre de grandeur, pas un prix juste.</li>
            </ol>
          </details>

          {financial && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              Banques et assurances : le free cash flow n’a pas le même sens que pour une entreprise industrielle. Ce modèle est peu fiable ici.
            </p>
          )}
        </div>
      )}
      <p className="mt-4 text-[11px] text-zinc-500 dark:text-zinc-400">
        Simulation pédagogique, très sensible aux hypothèses. Ce n’est ni une estimation de Fi-Hub ni un conseil.
      </p>
    </Panel>
  );
}
