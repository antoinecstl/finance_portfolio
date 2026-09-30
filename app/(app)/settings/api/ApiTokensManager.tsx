'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

type ApiToken = {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

const EXPIRY_OPTIONS: Array<{ label: string; value: 30 | 90 | 365 | null }> = [
  { label: '30 jours', value: 30 },
  { label: '90 jours', value: 90 },
  { label: '1 an', value: 365 },
  { label: 'Sans expiration', value: null },
];

function tokenStatus(token: ApiToken): { label: string; active: boolean } {
  if (token.revoked_at) return { label: 'Révoqué', active: false };
  if (token.expires_at && new Date(token.expires_at).getTime() <= Date.now()) return { label: 'Expiré', active: false };
  return { label: 'Actif', active: true };
}

export function CopyButton({ value, label = 'Copier' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          /* Presse-papiers indisponible : l'utilisateur peut sélectionner le texte. */
        }
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--rule)] px-2.5 py-1.5 text-xs text-[color:var(--ink)] hover:bg-[color:var(--paper-2)] transition-colors"
      aria-label={label}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-[color:var(--gain)]" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copié' : label}
    </button>
  );
}

export function ApiTokensManager() {
  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<30 | 90 | 365 | null>(90);
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/api-tokens');
    if (!res.ok) {
      setError('Impossible de charger vos jetons.');
      setTokens([]);
      return;
    }
    const body = (await res.json()) as { items: ApiToken[] };
    setTokens(body.items);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNewToken(null);
    setCreating(true);
    try {
      const res = await fetch('/api/api-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), expiresInDays }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.message ?? body.issues?.[0]?.message ?? 'Création impossible.');
        return;
      }
      setNewToken(body.token);
      setName('');
      await load();
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (token: ApiToken) => {
    if (!window.confirm(`Révoquer « ${token.name} » ? Les outils qui l'utilisent perdront l'accès immédiatement.`)) return;
    setRevokingId(token.id);
    setError(null);
    try {
      const res = await fetch(`/api/api-tokens/${token.id}`, { method: 'DELETE' });
      if (!res.ok) setError('Révocation impossible.');
      await load();
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-[color:var(--ink)]">Jetons d&apos;accès</h3>
        <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
          Un jeton donne un accès en lecture seule à vos comptes, positions et transactions. Créez-en un par
          outil pour pouvoir les révoquer séparément. Ne le partagez jamais.
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          <span className="mb-1 block text-[color:var(--ink-soft)]">Nom du jeton</span>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="ex. ChatGPT, Claude Desktop"
            maxLength={60}
            required
          />
        </label>
        <label className="text-sm sm:w-44">
          <span className="mb-1 block text-[color:var(--ink-soft)]">Expiration</span>
          <select
            className="input"
            value={expiresInDays ?? 'never'}
            onChange={(event) =>
              setExpiresInDays(event.target.value === 'never' ? null : (Number(event.target.value) as 30 | 90 | 365))
            }
          >
            {EXPIRY_OPTIONS.map((option) => (
              <option key={option.label} value={option.value ?? 'never'}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={creating || name.trim().length === 0}
          className="btn-ink inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Créer un jeton
        </button>
      </form>

      {newToken && (
        <div className="rounded-lg border border-[color:var(--gain)] bg-[color:var(--gain-soft)] px-4 py-3" role="status">
          <p className="text-sm font-medium text-[color:var(--ink)]">Copiez ce jeton maintenant : il ne sera plus affiché.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="mono min-w-0 flex-1 break-all rounded bg-[color:var(--paper)] px-2 py-1.5 text-xs text-[color:var(--ink)]">
              {newToken}
            </code>
            <CopyButton value={newToken} />
          </div>
        </div>
      )}

      {error && (
        <p className="flex items-center gap-2 text-sm text-[color:var(--loss)]" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {tokens === null ? (
        <div className="flex items-center gap-2 py-4 text-sm text-[color:var(--ink-soft)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : tokens.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-[color:var(--rule)] px-4 py-5 text-sm text-[color:var(--ink-soft)]">
          <KeyRound className="h-5 w-5 shrink-0" />
          Aucun jeton pour l&apos;instant.
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--rule)] rounded-lg border border-[color:var(--rule)]">
          {tokens.map((token) => {
            const status = tokenStatus(token);
            return (
              <li key={token.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-[color:var(--ink)]">
                    <span className="truncate">{token.name}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        status.active
                          ? 'bg-[color:var(--gain-soft)] text-[color:var(--gain)]'
                          : 'bg-[color:var(--paper-2)] text-[color:var(--ink-soft)]'
                      }`}
                    >
                      {status.label}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-[color:var(--ink-soft)]" suppressHydrationWarning>
                    <span className="mono">{token.token_prefix}…</span> · créé le {formatDateTime(token.created_at)}
                    {' · '}
                    {token.last_used_at ? `utilisé le ${formatDateTime(token.last_used_at)}` : 'jamais utilisé'}
                    {token.expires_at && status.active && ` · expire le ${formatDateTime(token.expires_at)}`}
                  </p>
                </div>
                {status.active && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(token)}
                    disabled={revokingId === token.id}
                    className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg px-2.5 py-1.5 text-xs text-[color:var(--loss)] hover:bg-[color:var(--loss-soft)] transition-colors disabled:opacity-50 sm:self-auto"
                  >
                    {revokingId === token.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Révoquer
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
