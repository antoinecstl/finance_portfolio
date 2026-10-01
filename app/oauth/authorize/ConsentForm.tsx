'use client';

import { useState } from 'react';
import { Check, Eye, Loader2, ShieldCheck, X } from 'lucide-react';

const PERMISSIONS = [
  'Voir vos comptes et leur valeur',
  'Voir vos positions, PRU et plus-values',
  'Voir l’historique de vos transactions',
];

export function ConsentForm({
  clientName,
  redirectHost,
  email,
  params,
}: {
  clientName: string;
  redirectHost: string;
  email: string;
  params: Record<string, string>;
}) {
  const [pending, setPending] = useState<'allow' | 'deny' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: 'allow' | 'deny') => {
    setPending(decision);
    setError(null);
    try {
      const res = await fetch('/api/oauth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, decision }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || typeof body.redirect_to !== 'string') {
        setError(body.message ?? 'Autorisation impossible, réessayez.');
        setPending(null);
        return;
      }
      // Navigation directe (et non un envoi de formulaire) : compatible avec la CSP form-action 'self'.
      window.location.assign(body.redirect_to);
    } catch {
      setError('Autorisation impossible, réessayez.');
      setPending(null);
    }
  };

  return (
    <div>
      <h1 className="text-lg font-semibold text-[color:var(--ink)]">
        {clientName} souhaite accéder à votre patrimoine Fi-Hub
      </h1>
      <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
        Redirection vers <strong className="mono text-xs text-[color:var(--ink)]">{redirectHost}</strong> · connecté en tant que <span className="text-[color:var(--ink)]">{email}</span>
      </p>

      <ul className="mt-5 space-y-2.5">
        {PERMISSIONS.map((permission) => (
          <li key={permission} className="flex items-start gap-2 text-sm text-[color:var(--ink)]">
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--ink-soft)]" />
            {permission}
          </li>
        ))}
      </ul>

      <p className="mt-5 flex items-start gap-2 rounded-lg bg-[color:var(--paper-2)] px-3 py-2.5 text-xs text-[color:var(--ink-soft)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--gain)]" />
        Lecture seule : l&apos;application ne peut rien modifier. Vous pouvez révoquer l&apos;accès à tout moment dans
        Paramètres → Accès API. N&apos;autorisez que les applications que vous venez de connecter vous-même.
      </p>

      {error && (
        <p className="mt-4 text-sm text-[color:var(--loss)]" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => decide('deny')}
          disabled={pending !== null}
          className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm text-[color:var(--ink-soft)] hover:bg-[color:var(--paper-2)] hover:text-[color:var(--ink)] disabled:opacity-50"
        >
          {pending === 'deny' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          Refuser
        </button>
        <button
          type="button"
          onClick={() => decide('allow')}
          disabled={pending !== null}
          className="btn-ink inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm"
        >
          {pending === 'allow' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Autoriser
        </button>
      </div>
    </div>
  );
}
