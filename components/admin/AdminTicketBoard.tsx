'use client';

import { useMemo, useState } from 'react';
import { Check, Clipboard, Loader2, Pencil, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import type { AdminTicket, TicketPriority, TicketStatus } from '@/lib/admin-tickets';
import { buildCodexPrompt } from '@/lib/codex-ticket';

const STATUS: { value: TicketStatus; label: string }[] = [
  { value: 'idea', label: 'Idées' },
  { value: 'planned', label: 'Planifiés' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'done', label: 'Terminés' },
];
const PRIORITY: Record<TicketPriority, { label: string; className: string }> = {
  low: { label: 'Basse', className: 'bg-[color:var(--paper-3)] text-[color:var(--ink-soft)]' },
  medium: { label: 'Normale', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  high: { label: 'Haute', className: 'bg-[color:var(--accent-soft)] text-[color:var(--accent)]' },
};

type Draft = Pick<AdminTicket, 'title' | 'description' | 'acceptanceCriteria' | 'tags' | 'status' | 'priority'>;
const EMPTY: Draft = { title: '', description: '', acceptanceCriteria: '', tags: [], status: 'idea', priority: 'medium' };

export function AdminTicketBoard({ initialTickets }: { initialTickets: AdminTicket[] }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminTicket | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tags = useMemo(() => [...new Set(tickets.flatMap((ticket) => ticket.tags))].sort(), [tickets]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (tag && !ticket.tags.includes(tag)) return false;
      return !needle || `${ticket.title} ${ticket.description} ${ticket.tags.join(' ')}`.toLowerCase().includes(needle);
    });
  }, [query, tag, tickets]);

  async function remove(ticket: AdminTicket) {
    if (!window.confirm(`Supprimer « ${ticket.title} » ?`)) return;
    setBusy(ticket.id);
    setError(null);
    try {
      const response = await fetch('/api/admin/tickets', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ticket.id }),
      });
      if (!response.ok) throw new Error();
      setTickets((current) => current.filter(({ id }) => id !== ticket.id));
    } catch {
      setError('Impossible de supprimer ce ticket. Réessaie.');
    } finally { setBusy(null); }
  }

  async function copyForCodex(ticket: AdminTicket) {
    try {
      await navigator.clipboard.writeText(buildCodexPrompt(ticket));
      setCopied(ticket.id);
      window.setTimeout(() => setCopied((id) => id === ticket.id ? null : id), 2000);
    } catch { setError('Le presse-papiers est inaccessible.'); }
  }

  return (
    <section className="mt-8" aria-labelledby="ticketing-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[color:var(--accent)]" />
            <h2 id="ticketing-title" className="display text-2xl text-[color:var(--ink)]">Backlog produit</h2>
          </div>
          <p className="mt-1 text-sm text-[color:var(--ink-soft)]">Capture tes idées, priorise-les et envoie un brief prêt à développer à Codex.</p>
        </div>
        <button type="button" onClick={() => setEditing('new')} className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--ink)] px-4 py-2.5 text-sm font-semibold text-[color:var(--paper)] hover:opacity-90">
          <Plus className="h-4 w-4" /> Nouveau ticket
        </button>
      </div>

      <div className="ink-card rounded-2xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Rechercher un ticket</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-soft)]" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher dans le backlog…" className="w-full rounded-xl border border-[color:var(--rule)] bg-[color:var(--paper)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[color:var(--ink-soft)]" />
          </label>
          <span className="text-xs tabular-nums text-[color:var(--ink-soft)]">{filtered.length} ticket{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        {tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setTag(null)} className={`rounded-full px-2.5 py-1 text-xs ${tag === null ? 'bg-[color:var(--ink)] text-[color:var(--paper)]' : 'bg-[color:var(--paper-2)] text-[color:var(--ink-soft)]'}`}>Tous</button>
          {tags.map((value) => <button type="button" key={value} onClick={() => setTag(value === tag ? null : value)} className={`rounded-full px-2.5 py-1 text-xs ${tag === value ? 'bg-[color:var(--ink)] text-[color:var(--paper)]' : 'bg-[color:var(--paper-2)] text-[color:var(--ink-soft)]'}`}>#{value}</button>)}
        </div>}
      </div>

      {error && <div role="alert" className="mt-3 rounded-xl border border-[color:var(--accent)] bg-[color:var(--accent-soft)] px-4 py-3 text-sm text-[color:var(--accent)]">{error}</div>}

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        {STATUS.map((column) => {
          const items = filtered.filter(({ status }) => status === column.value);
          return <div key={column.value} className="rounded-2xl bg-[color:var(--paper-2)] p-3 min-h-40">
            <div className="mb-3 flex items-center justify-between px-1"><h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ink-soft)]">{column.label}</h3><span className="rounded-full bg-[color:var(--paper)] px-2 py-0.5 text-xs tabular-nums text-[color:var(--ink-soft)]">{items.length}</span></div>
            <div className="space-y-2">
              {items.map((ticket) => <article key={ticket.id} className="rounded-xl border border-[color:var(--rule)] bg-[color:var(--paper)] p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2"><h4 className="text-sm font-semibold leading-snug text-[color:var(--ink)]">{ticket.title}</h4><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY[ticket.priority].className}`}>{PRIORITY[ticket.priority].label}</span></div>
                {ticket.description && <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[color:var(--ink-soft)]">{ticket.description}</p>}
                {ticket.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{ticket.tags.map((value) => <span key={value} className="rounded bg-[color:var(--paper-2)] px-1.5 py-0.5 text-[10px] text-[color:var(--ink-soft)]">#{value}</span>)}</div>}
                <div className="mt-3 flex items-center gap-1 border-t border-[color:var(--rule)] pt-2">
                  <button type="button" onClick={() => copyForCodex(ticket)} className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-[color:var(--accent)] hover:bg-[color:var(--accent-soft)]" title="Copier un brief complet pour Codex">{copied === ticket.id ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}{copied === ticket.id ? 'Copié' : 'Pour Codex'}</button>
                  <button type="button" onClick={() => setEditing(ticket)} className="rounded-lg p-1.5 text-[color:var(--ink-soft)] hover:bg-[color:var(--paper-2)] hover:text-[color:var(--ink)]" aria-label={`Modifier ${ticket.title}`}><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" disabled={busy === ticket.id} onClick={() => remove(ticket)} className="rounded-lg p-1.5 text-[color:var(--ink-soft)] hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--accent)] disabled:opacity-50" aria-label={`Supprimer ${ticket.title}`}>{busy === ticket.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</button>
                </div>
              </article>)}
              {items.length === 0 && <p className="py-8 text-center text-xs text-[color:var(--ink-soft)]">Aucun ticket</p>}
            </div>
          </div>;
        })}
      </div>
      {editing && <TicketEditor ticket={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={(ticket) => { setTickets((current) => editing === 'new' ? [ticket, ...current] : current.map((item) => item.id === ticket.id ? ticket : item)); setEditing(null); setError(null); }} onError={() => setError('Impossible d’enregistrer ce ticket. Vérifie les champs et réessaie.')} />}
    </section>
  );
}

function TicketEditor({ ticket, onClose, onSaved, onError }: { ticket: AdminTicket | null; onClose: () => void; onSaved: (ticket: AdminTicket) => void; onError: () => void }) {
  const [draft, setDraft] = useState<Draft>(ticket ?? EMPTY);
  const [tagInput, setTagInput] = useState(ticket?.tags.join(', ') ?? '');
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true);
    const payload = { ...draft, ...(ticket ? { id: ticket.id } : {}), tags: tagInput.split(',').map((value) => value.trim().replace(/^#/, '')).filter(Boolean) };
    try {
      const response = await fetch('/api/admin/tickets', { method: ticket ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error();
      const data = await response.json() as { ticket: AdminTicket }; onSaved(data.ticket);
    } catch { onError(); } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="ticket-editor-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form onSubmit={submit} className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-[color:var(--paper)] p-5 shadow-2xl sm:rounded-2xl sm:p-6">
      <div className="flex items-center justify-between"><div><h2 id="ticket-editor-title" className="display text-2xl">{ticket ? 'Modifier le ticket' : 'Nouvelle idée'}</h2><p className="mt-1 text-xs text-[color:var(--ink-soft)]">Plus le brief est précis, plus le transfert à Codex sera efficace.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-[color:var(--ink-soft)] hover:bg-[color:var(--paper-2)]" aria-label="Fermer"><X className="h-5 w-5" /></button></div>
      <div className="mt-5 space-y-4">
        <Field label="Titre"><input required maxLength={160} autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ex. Ajouter une vue dividendes annuelle" className="input" /></Field>
        <Field label="Contexte et besoin"><textarea rows={4} maxLength={10000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Pourquoi cette évolution est utile, comportement attendu…" className="input resize-y" /></Field>
        <Field label="Critères d’acceptation"><textarea rows={4} maxLength={10000} value={draft.acceptanceCriteria} onChange={(e) => setDraft({ ...draft, acceptanceCriteria: e.target.value })} placeholder={'- Le tableau affiche…\n- Le filtre permet de…'} className="input resize-y" /></Field>
        <Field label="Tags" hint="Séparés par des virgules"><input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="dashboard, ux, analytics" className="input" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Statut"><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as TicketStatus })} className="input">{STATUS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field><Field label="Priorité"><select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as TicketPriority })} className="input"><option value="low">Basse</option><option value="medium">Normale</option><option value="high">Haute</option></select></Field></div>
      </div>
      <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-[color:var(--rule)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--paper-2)]">Annuler</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--ink)] px-4 py-2 text-sm font-semibold text-[color:var(--paper)] disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{ticket ? 'Enregistrer' : 'Créer le ticket'}</button></div>
    </form>
  </div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 flex justify-between text-xs font-semibold text-[color:var(--ink)]"><span>{label}</span>{hint && <span className="font-normal text-[color:var(--ink-soft)]">{hint}</span>}</span>{children}</label>;
}
