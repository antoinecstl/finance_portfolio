'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { AdminTicket, TicketPriority, TicketStatus } from '@/lib/admin-tickets';
import { buildCodexPrompt } from '@/lib/codex-ticket';
import { filterAndSortAdminTickets, type AdminTicketStatusFilter } from '@/lib/admin-ticket-view';

const STATUSES: { value: TicketStatus; label: string; shortLabel: string }[] = [
  { value: 'idea', label: 'Idées à qualifier', shortLabel: 'Idées' },
  { value: 'planned', label: 'À faire', shortLabel: 'À faire' },
  { value: 'in_progress', label: 'En cours', shortLabel: 'En cours' },
  { value: 'done', label: 'Terminés', shortLabel: 'Terminés' },
];

const PRIORITIES: Record<TicketPriority, { label: string; className: string }> = {
  low: { label: 'Basse', className: 'bg-[color:var(--paper-3)] text-[color:var(--ink-soft)]' },
  medium: { label: 'Normale', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  high: { label: 'Haute', className: 'bg-[color:var(--accent-soft)] text-[color:var(--accent)]' },
};

type Draft = Pick<AdminTicket, 'title' | 'description' | 'acceptanceCriteria' | 'tags' | 'status' | 'priority'>;
const EMPTY: Draft = {
  title: '',
  description: '',
  acceptanceCriteria: '',
  tags: [],
  status: 'idea',
  priority: 'medium',
};

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

function ticketPayload(ticket: AdminTicket, updates: Partial<Draft> = {}) {
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    acceptanceCriteria: ticket.acceptanceCriteria,
    tags: ticket.tags,
    status: ticket.status,
    priority: ticket.priority,
    ...updates,
  };
}

export function AdminTicketBoard({ initialTickets }: { initialTickets: AdminTicket[] }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<AdminTicketStatusFilter>('open');
  const [tag, setTag] = useState('all');
  const [editing, setEditing] = useState<AdminTicket | 'new' | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tags = useMemo(() => [...new Set(tickets.flatMap((ticket) => ticket.tags))].sort(), [tickets]);
  const counts = useMemo(
    () => Object.fromEntries(STATUSES.map((item) => [item.value, tickets.filter((ticket) => ticket.status === item.value).length])) as Record<TicketStatus, number>,
    [tickets],
  );
  const openCount = tickets.length - counts.done;

  const filtered = useMemo(
    () => filterAndSortAdminTickets(tickets, { query, status, tag }),
    [query, status, tag, tickets],
  );

  async function saveUpdate(ticket: AdminTicket, updates: Partial<Draft>) {
    setBusy(ticket.id);
    setError(null);
    try {
      const response = await fetch('/api/admin/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketPayload(ticket, updates)),
      });
      if (!response.ok) throw new Error();
      const data = await response.json() as { ticket: AdminTicket };
      setTickets((current) => current.map((item) => item.id === data.ticket.id ? data.ticket : item));
    } catch {
      setError('La modification n’a pas pu être enregistrée. Réessaie.');
    } finally {
      setBusy(null);
    }
  }

  async function remove(ticket: AdminTicket) {
    if (!window.confirm(`Supprimer « ${ticket.title} » ?`)) return;
    setBusy(ticket.id);
    setError(null);
    try {
      const response = await fetch('/api/admin/tickets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ticket.id }),
      });
      if (!response.ok) throw new Error();
      setTickets((current) => current.filter(({ id }) => id !== ticket.id));
    } catch {
      setError('Impossible de supprimer ce ticket. Réessaie.');
    } finally {
      setBusy(null);
    }
  }

  async function copyForCodex(ticket: AdminTicket) {
    try {
      await navigator.clipboard.writeText(buildCodexPrompt(ticket));
      setCopied(ticket.id);
      window.setTimeout(() => setCopied((id) => id === ticket.id ? null : id), 2000);
    } catch {
      setError('Le presse-papiers est inaccessible.');
    }
  }

  return (
    <section className="mt-10 border-t border-[color:var(--rule)] pt-8" aria-labelledby="ticketing-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-[color:var(--ink-soft)]">Pilotage produit</p>
          <h2 id="ticketing-title" className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--ink)]">
            Suivi des tickets
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[color:var(--ink-soft)]">
            {openCount} sujet{openCount !== 1 ? 's' : ''} ouvert{openCount !== 1 ? 's' : ''}. Qualifie une idée, passe-la à faire, puis suis son avancement.
          </p>
        </div>
        <button type="button" onClick={() => setEditing('new')} className="btn-ink inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Ajouter un ticket
        </button>
      </div>

      <div className="mt-6 overflow-x-auto border-b border-[color:var(--rule)]" role="tablist" aria-label="Filtrer par statut">
        <div className="flex min-w-max gap-6">
          <StatusTab active={status === 'open'} label="Ouverts" count={openCount} onClick={() => setStatus('open')} />
          {STATUSES.map((item) => (
            <StatusTab key={item.value} active={status === item.value} label={item.shortLabel} count={counts[item.value]} onClick={() => setStatus(item.value)} />
          ))}
          <StatusTab active={status === 'all'} label="Tous" count={tickets.length} onClick={() => setStatus('all')} />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Rechercher un ticket</span>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-soft)]" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un titre, un besoin ou un critère…" className="input pl-9" />
        </label>
        <label className="relative sm:w-52">
          <span className="sr-only">Filtrer par tag</span>
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-soft)]" />
          <select value={tag} onChange={(event) => setTag(event.target.value)} className="input appearance-none pl-9 pr-8">
            <option value="all">Tous les tags</option>
            {tags.map((value) => <option key={value} value={value}>#{value}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-soft)]" />
        </label>
      </div>

      {error && <div role="alert" className="mt-3 rounded-lg border border-[color:var(--accent)] bg-[color:var(--accent-soft)] px-4 py-3 text-sm text-[color:var(--accent)]">{error}</div>}

      <div className="mt-4 overflow-hidden rounded-xl border border-[color:var(--rule)] bg-[color:var(--paper)]">
        {filtered.map((ticket) => {
          const expanded = expandedId === ticket.id;
          const statusLabel = STATUSES.find((item) => item.value === ticket.status)?.shortLabel;
          return (
            <article key={ticket.id} className="border-b border-[color:var(--rule)] last:border-0">
              <div className="flex items-start gap-3 p-4 sm:items-center">
                <button type="button" onClick={() => setExpandedId(expanded ? null : ticket.id)} className="mt-0.5 rounded p-1 text-[color:var(--ink-soft)] hover:bg-[color:var(--paper-2)] sm:mt-0" aria-expanded={expanded} aria-label={`${expanded ? 'Replier' : 'Déplier'} ${ticket.title}`}>
                  <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </button>
                <button type="button" onClick={() => setExpandedId(expanded ? null : ticket.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold text-[color:var(--ink)]">{ticket.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[color:var(--ink-soft)]">
                    <span>{statusLabel}</span><span aria-hidden="true">·</span><span>Mis à jour le {dateFormatter.format(new Date(ticket.updatedAt))}</span>
                    {ticket.tags.slice(0, 2).map((value) => <span key={value}>#{value}</span>)}
                  </span>
                </button>
                <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline ${PRIORITIES[ticket.priority].className}`}>{PRIORITIES[ticket.priority].label}</span>
                <label className="relative hidden sm:block">
                  <span className="sr-only">Statut de {ticket.title}</span>
                  <select value={ticket.status} disabled={busy === ticket.id} onChange={(event) => saveUpdate(ticket, { status: event.target.value as TicketStatus })} className="rounded-lg border border-[color:var(--rule)] bg-[color:var(--paper)] py-1.5 pl-2.5 pr-7 text-xs font-medium text-[color:var(--ink)] disabled:opacity-50">
                    {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.shortLabel}</option>)}
                  </select>
                  {busy === ticket.id ? <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin" /> : <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />}
                </label>
              </div>

              {expanded && (
                <div className="border-t border-[color:var(--rule)] bg-[color:var(--paper-2)] px-4 py-4 sm:pl-12">
                  <div className="grid gap-5 lg:grid-cols-2">
                    <TicketText title="Contexte" value={ticket.description} empty="Aucun contexte renseigné." />
                    <TicketText title="Critères d’acceptation" value={ticket.acceptanceCriteria} empty="Aucun critère renseigné." />
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[color:var(--rule)] pt-3">
                    <label className="relative sm:hidden">
                      <span className="sr-only">Statut de {ticket.title}</span>
                      <select value={ticket.status} disabled={busy === ticket.id} onChange={(event) => saveUpdate(ticket, { status: event.target.value as TicketStatus })} className="rounded-lg border border-[color:var(--rule)] bg-[color:var(--paper)] py-2 pl-3 pr-8 text-xs font-medium">
                        {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.shortLabel}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
                    </label>
                    <button type="button" onClick={() => copyForCodex(ticket)} className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--rule)] bg-[color:var(--paper)] px-3 py-2 text-xs font-medium hover:bg-[color:var(--paper-3)]">
                      {copied === ticket.id ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}{copied === ticket.id ? 'Brief copié' : 'Copier le brief'}
                    </button>
                    <button type="button" onClick={() => setEditing(ticket)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium hover:bg-[color:var(--paper-3)]"><Pencil className="h-3.5 w-3.5" /> Modifier</button>
                    <button type="button" disabled={busy === ticket.id} onClick={() => remove(ticket)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-[color:var(--accent)] hover:bg-[color:var(--accent-soft)] disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Supprimer</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center">
            <p className="font-medium text-[color:var(--ink)]">Aucun ticket dans cette vue</p>
            <p className="mt-1 text-sm text-[color:var(--ink-soft)]">Modifie les filtres ou ajoute le prochain sujet à traiter.</p>
            <button type="button" onClick={() => setEditing('new')} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4"><Plus className="h-4 w-4" /> Ajouter un ticket</button>
          </div>
        )}
      </div>

      {editing && (
        <TicketEditor
          ticket={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(ticket) => {
            setTickets((current) => editing === 'new' ? [ticket, ...current] : current.map((item) => item.id === ticket.id ? ticket : item));
            setEditing(null);
            setExpandedId(ticket.id);
            setError(null);
          }}
          onError={() => setError('Impossible d’enregistrer ce ticket. Vérifie les champs et réessaie.')}
        />
      )}
    </section>
  );
}

function StatusTab({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`relative flex items-center gap-2 pb-3 text-sm font-medium ${active ? 'text-[color:var(--ink)]' : 'text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]'}`}>{label}<span className="rounded-full bg-[color:var(--paper-2)] px-1.5 py-0.5 text-[10px] tabular-nums">{count}</span>{active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[color:var(--ink)]" />}</button>;
}

function TicketText({ title, value, empty }: { title: string; value: string; empty: string }) {
  return <div><h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ink-soft)]">{title}</h3>{value ? <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[color:var(--ink-2)]">{value}</p> : <p className="mt-2 text-sm italic text-[color:var(--ink-soft)]">{empty}</p>}</div>;
}

function TicketEditor({ ticket, onClose, onSaved, onError }: { ticket: AdminTicket | null; onClose: () => void; onSaved: (ticket: AdminTicket) => void; onError: () => void }) {
  const [draft, setDraft] = useState<Draft>(ticket ?? EMPTY);
  const [tagInput, setTagInput] = useState(ticket?.tags.join(', ') ?? '');
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const payload = {
      ...draft,
      ...(ticket ? { id: ticket.id } : {}),
      tags: tagInput.split(',').map((value) => value.trim().replace(/^#/, '')).filter(Boolean),
    };
    try {
      const response = await fetch('/api/admin/tickets', {
        method: ticket ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error();
      const data = await response.json() as { ticket: AdminTicket };
      onSaved(data.ticket);
    } catch {
      onError();
    } finally {
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="ticket-editor-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form onSubmit={submit} className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-[color:var(--paper)] p-5 shadow-2xl sm:rounded-2xl sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium text-[color:var(--ink-soft)]">{ticket ? 'Édition' : 'Nouveau sujet'}</p><h2 id="ticket-editor-title" className="mt-1 text-2xl font-semibold tracking-tight">{ticket ? 'Modifier le ticket' : 'Ajouter au backlog'}</h2><p className="mt-1 text-sm text-[color:var(--ink-soft)]">Commence par le besoin. Le statut et la priorité peuvent évoluer ensuite.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-[color:var(--ink-soft)] hover:bg-[color:var(--paper-2)]" aria-label="Fermer"><X className="h-5 w-5" /></button></div>
      <div className="mt-6 space-y-5">
        <Field label="Titre" required><input required maxLength={160} autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Quel problème faut-il résoudre ?" className="input" /></Field>
        <Field label="Contexte et résultat attendu" hint="Pourquoi ce sujet compte"><textarea rows={4} maxLength={10000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Décris le problème actuel et ce qui devrait être plus simple…" className="input resize-y" /></Field>
        <Field label="Critères d’acceptation" hint="Un résultat vérifiable par ligne"><textarea rows={4} maxLength={10000} value={draft.acceptanceCriteria} onChange={(event) => setDraft({ ...draft, acceptanceCriteria: event.target.value })} placeholder={'- L’utilisateur peut…\n- Le dashboard affiche…'} className="input resize-y" /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Étape"><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as TicketStatus })} className="input">{STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field><Field label="Priorité"><select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as TicketPriority })} className="input"><option value="low">Basse</option><option value="medium">Normale</option><option value="high">Haute</option></select></Field></div>
        <Field label="Tags" hint="Facultatif, séparés par des virgules"><input value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="dashboard, ux" className="input" /></Field>
      </div>
      <div className="mt-7 flex justify-end gap-2 border-t border-[color:var(--rule)] pt-4"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[color:var(--paper-2)]">Annuler</button><button type="submit" disabled={saving} className="btn-ink inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{ticket ? 'Enregistrer' : 'Ajouter le ticket'}</button></div>
    </form>
  </div>;
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 flex justify-between gap-3 text-sm font-medium text-[color:var(--ink)]"><span>{label}{required && <span className="text-[color:var(--accent)]"> *</span>}</span>{hint && <span className="text-right text-xs font-normal text-[color:var(--ink-soft)]">{hint}</span>}</span>{children}</label>;
}
