'use client';

// Calculateur de PRU public : tout se calcule dans le navigateur, rien n'est
// envoyé ni enregistré. Logique dans lib/pru.ts.

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { parseDecimal } from '@/lib/decimal';
import { computePru, latentGain, type PruOperation } from '@/lib/pru';

interface Row {
  id: number;
  type: 'buy' | 'sell';
  quantity: string;
  price: string;
  fees: string;
}

const euros = (amount: number, digits = 2) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
const signed = (amount: number) => `${amount >= 0 ? '+' : '−'}${euros(Math.abs(amount))}`;

const EXAMPLE: Row[] = [
  { id: 1, type: 'buy', quantity: '10', price: '100', fees: '1,99' },
  { id: 2, type: 'buy', quantity: '15', price: '84', fees: '1,99' },
];

const isBlank = (row: Row) => !row.quantity.trim() && !row.price.trim() && !row.fees.trim();

export function PruCalculator() {
  const [rows, setRows] = useState<Row[]>(EXAMPLE);
  const [nextId, setNextId] = useState(3);
  const [currentPrice, setCurrentPrice] = useState('');

  const update = (id: number, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = (type: Row['type']) => {
    setRows((prev) => [...prev, { id: nextId, type, quantity: '', price: '', fees: '' }]);
    setNextId((n) => n + 1);
  };

  const outcome = useMemo(() => {
    const filled = rows.filter((row) => !isBlank(row));
    const operations: PruOperation[] = filled.map((row) => ({
      type: row.type,
      quantity: parseDecimal(row.quantity),
      price: parseDecimal(row.price),
      fees: row.fees.trim() ? parseDecimal(row.fees) : 0,
    }));
    const result = computePru(operations);
    // La ligne en erreur est repérée parmi les lignes remplies.
    return result.ok ? result : { ...result, rowId: filled[result.row]?.id };
  }, [rows]);

  const price = parseDecimal(currentPrice);
  const latent = outcome.ok ? latentGain(outcome.result, price) : null;
  const errorRowId = outcome.ok ? null : outcome.rowId;

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:p-6">
      <div className="space-y-3">
        {rows.map((row, index) => (
          <fieldset
            key={row.id}
            className={`rounded-lg border p-3 ${errorRowId === row.id ? 'border-[color:var(--danger)]' : 'border-[color:var(--border)]'}`}
          >
            <legend className="sr-only">Opération {index + 1}</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[8.5rem_1fr_1fr_1fr_auto] sm:items-end">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor={`pru-type-${row.id}`} className="mb-1 block text-[13px] text-[color:var(--text-muted)]">
                  Opération
                </label>
                <select
                  id={`pru-type-${row.id}`}
                  value={row.type}
                  onChange={(e) => update(row.id, { type: e.target.value as Row['type'] })}
                  className="field-input"
                >
                  <option value="buy">Achat</option>
                  <option value="sell">Vente</option>
                </select>
              </div>
              <div>
                <label htmlFor={`pru-qty-${row.id}`} className="mb-1 block text-[13px] text-[color:var(--text-muted)]">
                  Quantité
                </label>
                <input id={`pru-qty-${row.id}`} type="text" inputMode="decimal" value={row.quantity} onChange={(e) => update(row.id, { quantity: e.target.value })} className="field-input" />
              </div>
              <div>
                <label htmlFor={`pru-price-${row.id}`} className="mb-1 block text-[13px] text-[color:var(--text-muted)]">
                  Prix unitaire (€)
                </label>
                <input id={`pru-price-${row.id}`} type="text" inputMode="decimal" value={row.price} onChange={(e) => update(row.id, { price: e.target.value })} className="field-input" />
              </div>
              <div>
                <label htmlFor={`pru-fees-${row.id}`} className="mb-1 block text-[13px] text-[color:var(--text-muted)]">
                  Frais (€)
                </label>
                <input id={`pru-fees-${row.id}`} type="text" inputMode="decimal" value={row.fees} onChange={(e) => update(row.id, { fees: e.target.value })} placeholder="0" className="field-input" />
              </div>
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                aria-label={`Supprimer l’opération ${index + 1}`}
                className="flex h-11 w-11 items-center justify-center justify-self-end rounded-md text-[color:var(--text-muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)]"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => addRow('buy')} className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] px-3.5 py-2 text-sm font-medium text-[color:var(--text)] hover:bg-[color:var(--surface-2)]">
          <Plus className="h-4 w-4" aria-hidden="true" /> Ajouter un achat
        </button>
        <button type="button" onClick={() => addRow('sell')} className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] px-3.5 py-2 text-sm font-medium text-[color:var(--text)] hover:bg-[color:var(--surface-2)]">
          <Plus className="h-4 w-4" aria-hidden="true" /> Ajouter une vente
        </button>
      </div>

      <div className="mt-6 max-w-xs">
        <label htmlFor="pru-current" className="mb-1 block text-sm font-medium text-[color:var(--text)]">
          Cours actuel (€), facultatif
        </label>
        <input id="pru-current" type="text" inputMode="decimal" value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} placeholder="Pour voir votre plus-value latente" className="field-input" />
      </div>

      <div aria-live="polite" className="mt-6 border-t border-[color:var(--text)] pt-5">
        {!outcome.ok ? (
          <p role="alert" className="text-[15px] text-[color:var(--danger)]">
            {outcome.error}
          </p>
        ) : outcome.result.quantity === 0 && outcome.result.realizedGain === 0 ? (
          <p className="text-[15px] text-[color:var(--text-2)]">Saisissez au moins un achat pour calculer votre PRU.</p>
        ) : (
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-[13px] text-[color:var(--text-muted)]">Prix de revient unitaire (frais inclus)</dt>
              <dd className="mt-0.5 text-3xl font-semibold tracking-[-0.02em] text-[color:var(--text)]">
                {outcome.result.quantity > 0 ? euros(outcome.result.pru, 4).replace(/,?0{1,2}(\s€)$/, '$1') : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-[color:var(--text-muted)]">Quantité détenue · coût de revient</dt>
              <dd className="mt-0.5 text-lg font-medium text-[color:var(--text)]">
                {outcome.result.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} · {euros(outcome.result.cost)}
              </dd>
            </div>
            {latent && (
              <div>
                <dt className="text-[13px] text-[color:var(--text-muted)]">Plus-value latente au cours actuel</dt>
                <dd className={`mt-0.5 text-lg font-medium ${latent.gain >= 0 ? 'text-[color:var(--gain)]' : 'text-[color:var(--danger)]'}`}>
                  {signed(latent.gain)} ({latent.percent >= 0 ? '+' : '−'}
                  {Math.abs(latent.percent).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %)
                </dd>
              </div>
            )}
            {outcome.result.realizedGain !== 0 && (
              <div>
                <dt className="text-[13px] text-[color:var(--text-muted)]">Plus-value réalisée sur les ventes</dt>
                <dd className={`mt-0.5 text-lg font-medium ${outcome.result.realizedGain >= 0 ? 'text-[color:var(--gain)]' : 'text-[color:var(--danger)]'}`}>
                  {signed(outcome.result.realizedGain)}
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>
      <p className="mt-4 text-[13px] text-[color:var(--text-muted)]">
        Le calcul se fait dans votre navigateur : rien n’est envoyé ni enregistré.
      </p>
    </div>
  );
}
