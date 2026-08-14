'use client';

import { Fragment, useMemo, useState } from 'react';
import {
  Search,
  ArrowUpDown,
  Crown,
  Wallet,
  Receipt,
  Calendar,
  Clock,
  ChevronDown,
  Loader2,
  Check,
} from 'lucide-react';
import type { AdminUserRow, AdminPlanTag } from '@/lib/admin-types';

const dtf = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
const df = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });

type PlanFilter = 'all' | AdminPlanTag;
type SortKey = 'createdAt' | 'lastSignInAt' | 'transactions' | 'accounts';

const PLAN_BADGE: Record<AdminPlanTag, string> = {
  founder: 'bg-[color:var(--ink)] text-[color:var(--paper)]',
  pro: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  free: 'bg-[color:var(--paper-3)] text-[color:var(--ink-soft)]',
};

const PLAN_LABEL: Record<AdminPlanTag, string> = {
  founder: 'Fondateur',
  pro: 'Pro',
  free: 'Free',
};

const FILTERS: { key: PlanFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'free', label: 'Free' },
  { key: 'pro', label: 'Pro' },
  { key: 'founder', label: 'Fondateurs' },
];

function displayTag(row: AdminUserRow, founder: boolean): AdminPlanTag {
  if (founder) return 'founder';
  return row.plan === 'pro' ? 'pro' : 'free';
}

export function AdminUsersTable({ users }: { users: AdminUserRow[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PlanFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Overrides fondateur locaux (id -> bool) après action, + état de chargement/erreur.
  const [founderOverride, setFounderOverride] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isFounder = (row: AdminUserRow) =>
    row.id in founderOverride ? founderOverride[row.id] : row.isFounder;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = users.filter((u) => {
      if (q && !(u.email ?? '').toLowerCase().includes(q)) return false;
      if (filter === 'all') return true;
      return displayTag(u, isFounder(u)) === filter;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'transactions') cmp = a.transactions - b.transactions;
      else if (sortKey === 'accounts') cmp = a.accounts - b.accounts;
      else {
        const av = a[sortKey] ? new Date(a[sortKey] as string).getTime() : 0;
        const bv = b[sortKey] ? new Date(b[sortKey] as string).getTime() : 0;
        cmp = av - bv;
      }
      return cmp * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, query, filter, sortKey, sortDir, founderOverride]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  async function toggleFounder(row: AdminUserRow) {
    const next = !isFounder(row);
    setPending(row.id);
    setError(null);
    try {
      const res = await fetch('/api/admin/founder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: row.id, isFounder: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFounderOverride((prev) => ({ ...prev, [row.id]: next }));
    } catch {
      setError(`Échec de la mise à jour pour ${row.email ?? row.id}.`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="ink-card rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-[color:var(--ink)]">
          Utilisateurs
          <span className="ml-2 text-[color:var(--ink-soft)] font-normal tabular-nums">
            {filtered.length}/{users.length}
          </span>
        </h3>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[color:var(--ink-soft)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un email…"
            className="w-56 max-w-full rounded-lg border border-[color:var(--rule)] bg-[color:var(--paper)] pl-8 pr-3 py-1.5 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)]"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.key
                ? 'bg-[color:var(--ink)] text-[color:var(--paper)]'
                : 'bg-[color:var(--paper-2)] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-[color:var(--accent)] bg-[color:var(--accent-soft)] px-3 py-2 text-xs text-[color:var(--accent)]">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[color:var(--ink-soft)] border-b border-[color:var(--rule)]">
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Plan</th>
              <SortableTh label="Comptes" active={sortKey === 'accounts'} dir={sortDir} onClick={() => toggleSort('accounts')} align="right" />
              <SortableTh label="Transac." active={sortKey === 'transactions'} dir={sortDir} onClick={() => toggleSort('transactions')} align="right" />
              <SortableTh label="Inscrit" active={sortKey === 'createdAt'} dir={sortDir} onClick={() => toggleSort('createdAt')} />
              <SortableTh label="Vu" active={sortKey === 'lastSignInAt'} dir={sortDir} onClick={() => toggleSort('lastSignInAt')} />
              <th className="py-2 w-6" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const founder = isFounder(u);
              const tag = displayTag(u, founder);
              const open = expandedId === u.id;
              return (
                <Fragment key={u.id}>
                  <tr
                    onClick={() => setExpandedId(open ? null : u.id)}
                    className="border-b border-[color:var(--rule)] last:border-0 cursor-pointer hover:bg-[color:var(--paper)]"
                  >
                    <td className="py-2.5 pr-4 text-[color:var(--ink)] max-w-[220px] truncate">
                      {u.email ?? '—'}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PLAN_BADGE[tag]}`}>
                        {PLAN_LABEL[tag]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-[color:var(--ink-2)]">{u.accounts}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-[color:var(--ink-2)]">{u.transactions}</td>
                    <td className="py-2.5 pr-4 text-[color:var(--ink-soft)] whitespace-nowrap">{df.format(new Date(u.createdAt))}</td>
                    <td className="py-2.5 pr-4 text-[color:var(--ink-soft)] whitespace-nowrap">
                      {u.lastSignInAt ? df.format(new Date(u.lastSignInAt)) : '—'}
                    </td>
                    <td className="py-2.5 text-[color:var(--ink-soft)]">
                      <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-[color:var(--rule)] bg-[color:var(--paper)]">
                      <td colSpan={7} className="px-1 py-4">
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                          <Detail icon={Crown} label="Statut" value={founder ? 'Fondateur (Pro offert)' : PLAN_LABEL[tag]} />
                          <Detail icon={Wallet} label="Comptes" value={String(u.accounts)} />
                          <Detail icon={Receipt} label="Transactions" value={String(u.transactions)} />
                          <Detail icon={Calendar} label="Inscrit le" value={dtf.format(new Date(u.createdAt))} />
                          <Detail
                            icon={Clock}
                            label="Dernière connexion"
                            value={u.lastSignInAt ? dtf.format(new Date(u.lastSignInAt)) : 'Jamais'}
                          />
                          <div className="ml-auto flex items-center gap-2">
                            <span className="mono text-[10px] text-[color:var(--ink-soft)] select-all">{u.id}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFounder(u);
                              }}
                              disabled={pending === u.id}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                                founder
                                  ? 'border border-[color:var(--rule)] text-[color:var(--ink)] hover:bg-[color:var(--paper-2)]'
                                  : 'bg-[color:var(--ink)] text-[color:var(--paper)] hover:opacity-90'
                              }`}
                            >
                              {pending === u.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : founder ? (
                                <Crown className="h-3.5 w-3.5" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              {founder ? 'Retirer fondateur' : 'Comper en Pro (fondateur)'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[color:var(--ink-soft)]">
                  Aucun utilisateur ne correspond.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
  align?: 'left' | 'right';
}) {
  return (
    <th className={`py-2 pr-4 font-medium ${align === 'right' ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 uppercase tracking-wide ${
          active ? 'text-[color:var(--ink)]' : 'text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]'
        }`}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
        {active && <span aria-hidden="true">{dir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Crown;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-[color:var(--ink-soft)]" />
      <div>
        <div className="text-[10px] uppercase tracking-wide text-[color:var(--ink-soft)]">{label}</div>
        <div className="text-sm text-[color:var(--ink)]">{value}</div>
      </div>
    </div>
  );
}
