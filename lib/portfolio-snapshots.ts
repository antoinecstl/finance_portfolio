import { supabase } from '@/lib/supabase';
import type { PortfolioHistoryPoint } from '@/lib/portfolio-calculator';

// Contrat du cache snapshots :
//  - lecture = SELECT sur portfolio_snapshots (RLS scope par user).
//  - écriture = upsert par jour. L'invalidation est gérée côté DB par le trigger
//    invalidate_portfolio_snapshots (déclenché à chaque insert/update/delete transaction).
//
// Idempotent : un snapshot peut être re-calculé sans conséquence.
// Optionnel : si la table n'existe pas encore, toutes les fonctions no-op (console.warn).

export type SnapshotRow = {
  date: string;
  total_value: number;
  stocks_value: number;
  savings_value: number;
  breakdown: unknown;
};

export async function readSnapshots(
  userId: string,
  startDate: string,
  endDate: string
): Promise<SnapshotRow[]> {
  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .select('date, total_value, stocks_value, savings_value, breakdown')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) {
    // Migration pas encore appliquée ou transient : on dégrade en no-cache.
    console.warn('[snapshots] read failed, falling back to recompute', error.message);
    return [];
  }
  return (data ?? []) as SnapshotRow[];
}

export async function upsertSnapshots(
  userId: string,
  points: PortfolioHistoryPoint[]
): Promise<void> {
  if (points.length === 0) return;

  // Dedupe par date — un payload avec deux fois la même clé (user_id, date)
  // fait échouer l'upsert avec "ON CONFLICT DO UPDATE command cannot affect
  // row a second time". Le dernier point gagne (les snapshots sont idempotents).
  const byDate = new Map<string, PortfolioHistoryPoint>();
  for (const p of points) byDate.set(p.date, p);

  const rows = Array.from(byDate.values()).map((p) => ({
    user_id: userId,
    date: p.date,
    total_value: p.totalValue,
    stocks_value: p.stocksValue,
    savings_value: p.savingsValue,
    breakdown: { positions: p.positions },
  }));

  const { error } = await supabase
    .from('portfolio_snapshots')
    .upsert(rows, { onConflict: 'user_id,date' });

  if (error) {
    // Non bloquant : le calculator reste source de vérité, on perd juste le cache.
    console.warn('[snapshots] upsert failed', error.message);
  }
}

// Construit la liste des dates manquantes entre snapshots existants et plage demandée.
// Utilisée pour ne recalculer QUE les trous (ex: hier ajouté, les 29 jours précédents restent cache).
export function missingDates(
  existing: SnapshotRow[],
  startDate: string,
  endDate: string,
  interval: 'daily' | 'weekly' | 'monthly'
): string[] {
  const existingSet = new Set(existing.map((s) => s.date));
  const all: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    all.push(current.toISOString().split('T')[0]);
    // UTC-only stepping: setDate/getDate are local-time, which collides with
    // toISOString (UTC) around DST transitions and produces duplicate dates.
    if (interval === 'daily') current.setUTCDate(current.getUTCDate() + 1);
    else if (interval === 'weekly') current.setUTCDate(current.getUTCDate() + 7);
    else current.setUTCMonth(current.getUTCMonth() + 1);
  }

  return all.filter((d) => !existingSet.has(d));
}
