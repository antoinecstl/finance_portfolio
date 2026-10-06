'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowRight, Check, Loader2, Search, Upload } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-errors';
import { useStockSearch } from '@/lib/hooks';
import { MONTHLY_TRIAL_LABEL, PLANS, formatPriceFor } from '@/lib/plans';
import {
  ONBOARDING_ACCOUNT_TYPES,
  ONBOARDING_STEPS,
  buildFirstTransactions,
  defaultAccountName,
  resolveOnboardingStep,
  type FirstTransactionInput,
  type OnboardingStep,
} from '@/lib/onboarding';
import { accountSupportsPositions, formatCurrency, isCryptoSymbol } from '@/lib/utils';
import type { Account, AccountType } from '@/lib/types';

export type OnboardingAccount = Pick<Account, 'id' | 'name' | 'type' | 'currency' | 'supports_positions'>;

interface OnboardingProps {
  email: string;
  initialProfile: { fullName: string; marketingOptIn: boolean; saved: boolean };
  initialAccounts: OnboardingAccount[];
  initialTransactionCount: number;
  hasImportAccess: boolean;
}

const INPUT =
  'w-full px-3 py-2.5 border border-[color:var(--rule)] rounded-lg bg-[color:var(--paper)] text-[color:var(--ink)] focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent';
const LABEL = 'block text-sm font-medium text-[color:var(--ink)] mb-1';
const SKIP = 'text-sm text-[color:var(--ink-soft)] underline underline-offset-4 hover:text-[color:var(--ink)] disabled:opacity-50';

const todayLocal = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD, fuseau du navigateur
const noSubscription = () => () => {};

// Date du jour du navigateur. Vide au rendu serveur (UTC), qui peut être déjà
// au lendemain ou encore à la veille : pas de décalage à l'hydratation.
function useToday(): string {
  return useSyncExternalStore(noSubscription, todayLocal, () => '');
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// Tunnel affiché à la première connexion, tant que l'onboarding n'est pas
// terminé : profil → premier compte → première opération → import (Pro,
// facultatif). Chaque étape agit pour de vrai ; on reprend à la bonne étape
// après un rechargement.
export function Onboarding({
  email,
  initialProfile,
  initialAccounts,
  initialTransactionCount,
  hasImportAccess,
}: OnboardingProps) {
  const [step, setStep] = useState<OnboardingStep>(() =>
    resolveOnboardingStep({
      profileSaved: initialProfile.saved,
      accountCount: initialAccounts.length,
      transactionCount: initialTransactionCount,
    })
  );
  const [accounts, setAccounts] = useState<OnboardingAccount[]>(initialAccounts);
  const [done, setDone] = useState<string[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // À chaque changement d'étape, le titre reçoit le focus (lecteurs d'écran,
  // clavier) ; pas au premier affichage.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const stepIndex = ONBOARDING_STEPS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)] flex items-start sm:items-center justify-center px-4 py-8 sm:py-10">
      <div className="w-full max-w-xl">
        <div className="mb-6 text-center">
          <span className="display text-4xl leading-none text-[color:var(--ink)]">Fi&#8209;Hub</span>
        </div>

        <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Étapes de la configuration">
          {ONBOARDING_STEPS.map((s, i) => (
            <li key={s.id} aria-current={i === stepIndex ? 'step' : undefined}>
              <span
                className={`block h-1.5 rounded-full transition-colors ${
                  i <= stepIndex ? 'bg-[color:var(--accent)]' : 'bg-[color:var(--rule)]'
                }`}
              />
              <span
                className={`mt-2 hidden sm:block text-xs ${
                  i === stepIndex ? 'text-[color:var(--ink)] font-medium' : 'text-[color:var(--ink-soft)]'
                }`}
              >
                {s.label}
              </span>
            </li>
          ))}
        </ol>
        <p className="sm:hidden mb-4 text-center text-xs text-[color:var(--ink-soft)]">
          Étape {stepIndex + 1} sur {ONBOARDING_STEPS.length} · {ONBOARDING_STEPS[stepIndex].label}
        </p>

        <div className="ink-card rounded-2xl pop-shadow p-6 sm:p-8">
          {step === 'profile' && (
            <ProfileStep
              email={email}
              initial={initialProfile}
              headingRef={headingRef}
              onDone={() =>
                setStep(resolveOnboardingStep({ profileSaved: true, accountCount: accounts.length, transactionCount: initialTransactionCount }))
              }
            />
          )}
          {step === 'account' && (
            <AccountStep
              headingRef={headingRef}
              onCreated={(account) => {
                setAccounts((prev) => [...prev, account]);
                setDone((prev) => [...prev, `Compte « ${account.name} » créé`]);
                setStep('transaction');
              }}
              onSkip={() => setStep('import')}
            />
          )}
          {step === 'transaction' && (
            <TransactionStep
              accounts={accounts}
              headingRef={headingRef}
              onDone={(labels) => {
                setDone((prev) => [...prev, ...labels]);
                setStep('import');
              }}
              onSkip={() => setStep('import')}
            />
          )}
          {step === 'import' && (
            <ImportStep done={done} hasImportAccess={hasImportAccess} headingRef={headingRef} />
          )}
        </div>
      </div>
    </div>
  );
}

type HeadingRef = React.RefObject<HTMLHeadingElement | null>;

function StepHeading({ headingRef, children }: { headingRef: HeadingRef; children: React.ReactNode }) {
  return (
    <h1 ref={headingRef} tabIndex={-1} className="display text-3xl leading-none text-[color:var(--ink)] mb-2 outline-none">
      {children}
    </h1>
  );
}

function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
      {message}
    </p>
  );
}

/* ───────── 1. Profil ───────── */

function ProfileStep({
  email,
  initial,
  headingRef,
  onDone,
}: {
  email: string;
  initial: OnboardingProps['initialProfile'];
  headingRef: HeadingRef;
  onDone: () => void;
}) {
  const [fullName, setFullName] = useState(initial.fullName);
  const [marketing, setMarketing] = useState(initial.marketingOptIn);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await postJson('/api/account/onboard', { step: 'profile', fullName, marketingOptIn: marketing });
      if (!res.ok) throw new Error(getApiErrorMessage(res.data, 'Erreur lors de l’enregistrement du profil.', res.status));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <StepHeading headingRef={headingRef}>Bienvenue sur Fi-Hub</StepHeading>
      <p className="text-[color:var(--ink-soft)] mb-6">
        Votre compte <span className="font-medium text-[color:var(--ink)]">{email}</span> est prêt. En deux minutes,
        nous allons préparer votre tableau de bord ensemble.
      </p>

      <ol className="mb-6 space-y-2 text-sm text-[color:var(--ink-soft)]">
        <li><span className="font-medium text-[color:var(--ink)]">1.</span> Créer votre premier compte : un PEA, un livret, une assurance-vie…</li>
        <li><span className="font-medium text-[color:var(--ink)]">2.</span> Ajouter une première opération.</li>
        <li><span className="font-medium text-[color:var(--ink)]">3.</span> Découvrir l’import de relevés, si vous voulez aller plus vite.</li>
      </ol>

      <div className="space-y-3">
        <div>
          <label htmlFor="onb-name" className={LABEL}>
            Comment vous appelle-t-on ? <span className="text-[color:var(--ink-soft)] font-normal">(facultatif)</span>
          </label>
          <input
            id="onb-name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jean Dupont"
            className={INPUT}
          />
        </div>
        <label className="flex items-start gap-2 text-sm cursor-pointer pt-2">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="mt-0.5 rounded border-[color:var(--rule)] text-[color:var(--accent)] focus:ring-[color:var(--accent)]"
          />
          <span className="text-[color:var(--ink-soft)]">
            Je souhaite recevoir des emails occasionnels sur les nouveautés produit.
          </span>
        </label>
      </div>

      <ErrorMessage message={error} />

      <div className="mt-8 flex justify-end">
        <button type="submit" disabled={submitting} className="btn-ink inline-flex items-center gap-2 py-2.5 px-5 rounded-lg disabled:opacity-50">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          Commencer
        </button>
      </div>
    </form>
  );
}

/* ───────── 2. Premier compte ───────── */

function AccountStep({
  headingRef,
  onCreated,
  onSkip,
}: {
  headingRef: HeadingRef;
  onCreated: (account: OnboardingAccount) => void;
  onSkip: () => void;
}) {
  const [type, setType] = useState<AccountType>('PEA');
  const [name, setName] = useState(defaultAccountName('PEA'));
  const [nameEdited, setNameEdited] = useState(false);
  const [autreSupportsPositions, setAutreSupportsPositions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseType = (next: AccountType) => {
    setType(next);
    if (!nameEdited) setName(defaultAccountName(next));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Donnez un nom à ce compte.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const body: Record<string, unknown> = { name: name.trim(), type, currency: 'EUR' };
    if (type === 'AUTRE') body.supports_positions = autreSupportsPositions;
    const res = await postJson('/api/accounts', body).catch(() => null);
    if (!res || !res.ok) {
      setError(
        res
          ? (typeof res.data.message === 'string' ? res.data.message : getApiErrorMessage(res.data, 'Erreur lors de la création du compte.', res.status))
          : 'Erreur réseau'
      );
      setSubmitting(false);
      return;
    }
    const account = res.data.account as OnboardingAccount | undefined;
    onCreated(account ?? { id: '', name: name.trim(), type, currency: 'EUR', supports_positions: null });
  };

  return (
    <form onSubmit={submit}>
      <StepHeading headingRef={headingRef}>Créez votre premier compte</StepHeading>
      <p className="text-[color:var(--ink-soft)] mb-6">
        Un compte correspond à une enveloppe : votre PEA, un livret, une assurance-vie… Commencez par celui que vous
        suivez le plus ; vous ajouterez les autres ensuite.
      </p>

      <fieldset>
        <legend className={LABEL}>Type de compte</legend>
        <div className="grid grid-cols-2 gap-2">
          {ONBOARDING_ACCOUNT_TYPES.map((option) => {
            const selected = option.type === type;
            return (
              <label
                key={option.type}
                className={`cursor-pointer rounded-lg border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[color:var(--accent)] ${
                  selected
                    ? 'border-[color:var(--ink)] bg-[color:var(--paper-2)]'
                    : 'border-[color:var(--rule)] hover:bg-[color:var(--paper-2)]'
                }`}
              >
                <input
                  type="radio"
                  name="onb-account-type"
                  value={option.type}
                  checked={selected}
                  onChange={() => chooseType(option.type)}
                  className="sr-only"
                />
                <span className="flex items-center justify-between gap-2 text-sm font-medium text-[color:var(--ink)]">
                  {option.label}
                  {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                </span>
                <span className="block text-xs text-[color:var(--ink-soft)]">{option.hint}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4">
        <label htmlFor="onb-account-name" className={LABEL}>Nom du compte</label>
        <input
          id="onb-account-name"
          type="text"
          value={name}
          maxLength={100}
          onChange={(e) => {
            setName(e.target.value);
            setNameEdited(true);
          }}
          className={INPUT}
        />
      </div>

      {type === 'AUTRE' && (
        <label className="mt-3 flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={autreSupportsPositions}
            onChange={(e) => setAutreSupportsPositions(e.target.checked)}
            className="mt-0.5 rounded border-[color:var(--rule)] text-[color:var(--accent)] focus:ring-[color:var(--accent)]"
          />
          <span className="text-[color:var(--ink-soft)]">Ce compte peut détenir des titres (PER, compte titres non standard…).</span>
        </label>
      )}

      <ErrorMessage message={error} />

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onSkip} disabled={submitting} className={SKIP}>
          Passer cette étape
        </button>
        <button type="submit" disabled={submitting} className="btn-ink inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-lg disabled:opacity-50">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          Créer le compte
        </button>
      </div>
    </form>
  );
}

/* ───────── 3. Première opération ───────── */

function TransactionStep({
  accounts,
  headingRef,
  onDone,
  onSkip,
}: {
  accounts: OnboardingAccount[];
  headingRef: HeadingRef;
  onDone: (labels: string[]) => void;
  onSkip: () => void;
}) {
  const [accountId, setAccountId] = useState(accounts[accounts.length - 1]?.id ?? '');
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const canHoldSecurities = account ? accountSupportsPositions(account) : false;
  const isCryptoAccount = account?.type === 'CRYPTO';
  const isSavings = account ? !canHoldSecurities : false;

  const [kind, setKind] = useState<'deposit' | 'buy'>('deposit');
  const [amount, setAmount] = useState('');
  const today = useToday();
  const [dateInput, setDate] = useState<string | null>(null);
  const date = dateInput ?? today;
  const [query, setQuery] = useState('');
  const [symbol, setSymbol] = useState<{ symbol: string; name: string } | null>(null);
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [quoteCurrency, setQuoteCurrency] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState<string[] | null>(null);
  const { results, loading: searching, search } = useStockSearch();

  const effectiveKind = canHoldSecurities ? kind : 'deposit';
  const accountCurrency = (account?.currency || 'EUR').toUpperCase();
  const buyCurrency = (quoteCurrency || accountCurrency).toUpperCase();
  const total = (parseFloat(quantity.replace(',', '.')) || 0) * (parseFloat(price.replace(',', '.')) || 0);
  const filteredResults = useMemo(
    () => results.filter((r) => (isCryptoAccount ? isCryptoSymbol(r.symbol) : !isCryptoSymbol(r.symbol))).slice(0, 6),
    [results, isCryptoAccount]
  );

  useEffect(() => {
    if (symbol || query.trim().length < 2) return;
    const timer = setTimeout(() => search(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query, symbol, search]);

  const pickSecurity = async (picked: { symbol: string; name: string }) => {
    setSymbol(picked);
    setQuery('');
    setQuoteCurrency(null);
    try {
      const res = await fetch(`/api/stocks/quotes?symbols=${encodeURIComponent(picked.symbol)}`);
      if (!res.ok) return;
      const data = await res.json();
      const quote = (data.quotes ?? [])[0] as { price?: number; currency?: string } | undefined;
      if (quote?.price) setPrice(String(Math.round(quote.price * 100) / 100));
      if (quote?.currency) setQuoteCurrency(quote.currency.toUpperCase());
    } catch {
      // Cours indisponible : l'utilisateur saisit le prix lui-même.
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    setError(null);

    const input: FirstTransactionInput =
      effectiveKind === 'deposit'
        ? { kind: 'deposit', amount: parseFloat(amount.replace(',', '.')), date }
        : {
            kind: 'buy',
            symbol: symbol?.symbol ?? '',
            quantity: parseFloat(quantity.replace(',', '.')),
            price: parseFloat(price.replace(',', '.')),
            date,
            currency: quoteCurrency,
          };
    const built = buildFirstTransactions(account, input);
    if (!built.ok) {
      setError(built.error);
      return;
    }

    setSubmitting(true);
    const labels: string[] = [];
    for (const payload of built.payloads) {
      const res = await postJson('/api/transactions', payload).catch(() => null);
      if (!res || !res.ok) {
        const message = res
          ? (typeof res.data.message === 'string' ? res.data.message : getApiErrorMessage(res.data, 'Erreur lors de l’enregistrement de l’opération.', res.status))
          : 'Erreur réseau';
        if (labels.length > 0) {
          // Le versement est passé, pas l'achat : on le dit et on laisse continuer.
          setError(`${message} Le versement a bien été enregistré ; vous pourrez ajouter l’achat depuis l’onglet Positions.`);
          setPartial(labels);
        } else {
          setError(message);
        }
        setSubmitting(false);
        return;
      }
      labels.push(
        payload.type === 'DEPOSIT'
          ? `Versement de ${formatCurrency(payload.amount, payload.currency)} ajouté`
          : `Achat de ${payload.quantity} ${payload.stock_symbol} ajouté`
      );
    }
    onDone(labels);
  };

  if (!account) {
    return (
      <div>
        <StepHeading headingRef={headingRef}>Ajoutez une première opération</StepHeading>
        <p className="text-[color:var(--ink-soft)]">Créez d’abord un compte pour y ajouter une opération.</p>
        <div className="mt-8 flex justify-end">
          <button type="button" onClick={onSkip} className="btn-ink inline-flex items-center gap-2 py-2.5 px-5 rounded-lg">
            Continuer <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <StepHeading headingRef={headingRef}>Ajoutez une première opération</StepHeading>
      <p className="text-[color:var(--ink-soft)] mb-6">
        Fi-Hub calcule les soldes, les positions et la performance à partir de vos opérations. Une seule suffit pour
        voir votre tableau de bord prendre forme.
      </p>

      {accounts.length > 1 && (
        <div className="mb-4">
          <label htmlFor="onb-tx-account" className={LABEL}>Compte</label>
          <select id="onb-tx-account" value={account.id} onChange={(e) => setAccountId(e.target.value)} className={INPUT}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      {canHoldSecurities && (
        <div role="radiogroup" aria-label="Type d’opération" className="mb-5 grid grid-cols-2 gap-2">
          {([
            ['deposit', 'Un versement', 'L’argent placé sur le compte'],
            ['buy', isCryptoAccount ? 'Un achat de crypto' : 'Un achat de titre', 'Une action, un ETF…'],
          ] as const).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              onClick={() => { setKind(value); setError(null); }}
              className={`flex flex-col items-start justify-start rounded-lg border px-3 py-2.5 text-left transition-colors ${
                kind === value ? 'border-[color:var(--ink)] bg-[color:var(--paper-2)]' : 'border-[color:var(--rule)] hover:bg-[color:var(--paper-2)]'
              }`}
            >
              <span className="block text-sm font-medium text-[color:var(--ink)]">{label}</span>
              <span className="block text-xs text-[color:var(--ink-soft)]">{value === 'buy' && isCryptoAccount ? 'Bitcoin, Ethereum…' : hint}</span>
            </button>
          ))}
        </div>
      )}

      {effectiveKind === 'deposit' ? (
        <div className="space-y-4">
          <p className="text-sm text-[color:var(--ink-soft)]">
            {isSavings
              ? 'Pour un livret, le plus simple est d’indiquer son solde actuel, daté d’aujourd’hui.'
              : 'L’argent que vous avez versé sur ce compte. Vous ajouterez vos achats ensuite.'}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="onb-amount" className={LABEL}>Montant ({accountCurrency})</label>
              <input id="onb-amount" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1 000" className={INPUT} />
            </div>
            <div>
              <label htmlFor="onb-date" className={LABEL}>Date</label>
              <input id="onb-date" type="date" value={date} max={today || undefined} onChange={(e) => setDate(e.target.value)} className={INPUT} />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <label htmlFor="onb-security" className={LABEL}>{isCryptoAccount ? 'Crypto' : 'Titre'}</label>
            {symbol ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--rule)] bg-[color:var(--paper-2)] px-3 py-2.5">
                <span className="min-w-0 truncate text-sm">
                  <span className="font-medium">{symbol.symbol}</span>
                  <span className="text-[color:var(--ink-soft)]"> · {symbol.name}</span>
                </span>
                <button type="button" onClick={() => { setSymbol(null); setQuoteCurrency(null); }} className={SKIP}>
                  Changer
                </button>
              </div>
            ) : (
              <>
                <Search className="pointer-events-none absolute left-3 top-[2.35rem] h-4 w-4 text-[color:var(--ink-soft)]" aria-hidden="true" />
                <input
                  id="onb-security"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={isCryptoAccount ? 'Bitcoin, BTC…' : 'Nom ou symbole, ex. CW8, Air Liquide'}
                  autoComplete="off"
                  className={`${INPUT} pl-9`}
                />
                {query.trim().length >= 2 && (
                  <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-[color:var(--rule)] bg-[color:var(--paper)] shadow-lg">
                    {searching && <li className="px-3 py-2 text-sm text-[color:var(--ink-soft)]">Recherche…</li>}
                    {!searching && filteredResults.length === 0 && (
                      <li className="px-3 py-2 text-sm text-[color:var(--ink-soft)]">Aucun résultat</li>
                    )}
                    {filteredResults.map((r) => (
                      <li key={r.symbol}>
                        <button
                          type="button"
                          onClick={() => pickSecurity(r)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-[color:var(--paper-2)]"
                        >
                          <span className="font-medium">{r.symbol}</span>
                          <span className="text-[color:var(--ink-soft)]"> · {r.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="onb-qty" className={LABEL}>Quantité</label>
              <input id="onb-qty" type="text" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="10" className={INPUT} />
            </div>
            <div>
              <label htmlFor="onb-price" className={LABEL}>Prix unitaire ({buyCurrency})</label>
              <input id="onb-price" type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label htmlFor="onb-buy-date" className={LABEL}>Date</label>
              <input id="onb-buy-date" type="date" value={date} max={today || undefined} onChange={(e) => setDate(e.target.value)} className={INPUT} />
            </div>
          </div>
          <p className="rounded-lg bg-[color:var(--paper-2)] px-3 py-2.5 text-sm text-[color:var(--ink-soft)]">
            {total > 0 ? (
              <>Total : <span className="font-medium text-[color:var(--ink)]">{formatCurrency(total, buyCurrency)}</span>. </>
            ) : null}
            Fi-Hub ajoute aussi le versement qui a financé cet achat, le même jour, pour que les liquidités du compte restent justes.
          </p>
        </div>
      )}

      <ErrorMessage message={error} />

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onSkip} disabled={submitting} className={SKIP}>
          Passer cette étape
        </button>
        {partial ? (
          <button type="button" onClick={() => onDone(partial)} className="btn-ink inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-lg">
            Continuer <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="submit" disabled={submitting} className="btn-ink inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-lg disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Ajouter l’opération
          </button>
        )}
      </div>
    </form>
  );
}

/* ───────── 4. Import (Pro, facultatif) ───────── */

function ImportStep({
  done,
  hasImportAccess,
  headingRef,
}: {
  done: string[];
  hasImportAccess: boolean;
  headingRef: HeadingRef;
}) {
  const [leaving, setLeaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { maxAccounts, maxTransactions, maxPositions } = PLANS.free;

  // Termine l'onboarding puis recharge l'app : le layout lit onboarded_at à
  // chaque rendu serveur, une navigation complète garantit son état à jour.
  const finish = async (href: string) => {
    setLeaving(href);
    setError(null);
    const res = await postJson('/api/account/onboard', { step: 'complete' }).catch(() => null);
    if (!res || !res.ok) {
      setError(res ? getApiErrorMessage(res.data, 'Erreur lors de la finalisation.', res.status) : 'Erreur réseau');
      setLeaving(null);
      return;
    }
    window.location.assign(href);
  };

  return (
    <div>
      {done.length > 0 && (
        <ul className="mb-6 space-y-1.5">
          {done.map((label) => (
            <li key={label} className="flex items-center gap-2 text-sm text-[color:var(--ink)]">
              <Check className="h-4 w-4 shrink-0 text-[color:var(--gain)]" aria-hidden="true" /> {label}
            </li>
          ))}
        </ul>
      )}

      <p className="mono mb-2 text-[11px] uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">
        {hasImportAccess ? 'Inclus dans votre offre' : 'Offre Pro · facultatif'}
      </p>
      <StepHeading headingRef={headingRef}>Pour aller plus vite : l’import de relevés</StepHeading>
      <p className="text-[color:var(--ink-soft)] mb-5">
        Vous avez déjà des années d’historique ? Déposez jusqu’à 5 relevés à la fois (CSV, Excel, PDF ou captures
        d’écran) : Fi-Hub propose les transactions, vous vérifiez chaque ligne, puis vous validez. Rien n’est
        enregistré sans votre accord.
      </p>

      <div className="rounded-lg border border-[color:var(--rule)] bg-[color:var(--paper-2)] p-4">
        <p className="text-sm font-medium text-[color:var(--ink)]">Ce n’est pas obligatoire.</p>
        <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
          Fi-Hub fonctionne pleinement sans import : vous saisissez vos opérations vous-même, et positions, PRU,
          performance et comparaison à un indice se calculent exactement de la même façon.
          {!hasImportAccess && ` L’offre Free reste gratuite jusqu’à ${maxAccounts} comptes, ${maxTransactions} transactions et ${maxPositions} positions.`}
        </p>
      </div>

      {!hasImportAccess && (
        <p className="mt-4 text-sm text-[color:var(--ink-soft)]">
          L’offre Pro ajoute aussi le module dividendes, des comptes et transactions illimités et la connexion à
          Claude ou ChatGPT : {formatPriceFor(PLANS.pro, 'month')}, {MONTHLY_TRIAL_LABEL.toLowerCase()}.
        </p>
      )}

      <ErrorMessage message={error} />

      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => finish('/dashboard')}
          disabled={leaving !== null}
          className="btn-ink inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-lg disabled:opacity-50"
        >
          {leaving === '/dashboard' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          Accéder à mon tableau de bord
        </button>
        <button
          type="button"
          onClick={() => finish(hasImportAccess ? '/dashboard/import' : '/settings/billing')}
          disabled={leaving !== null}
          className="btn-outline inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-lg disabled:opacity-50"
        >
          {leaving && leaving !== '/dashboard' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {hasImportAccess ? 'Importer un relevé' : 'Découvrir l’offre Pro'}
        </button>
      </div>
    </div>
  );
}
