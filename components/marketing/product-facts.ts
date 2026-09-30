// Facts reused across public pages, derived from the product's own sources of
// truth (plans, benchmark list) so marketing copy stays accurate.
import { BENCHMARK_LABELS } from '@/lib/benchmarks';
import { PLANS } from '@/lib/plans';

export const BENCHMARK_REFERENCE_COUNT = BENCHMARK_LABELS.length;

export function freePlanSummary(): string {
  const { maxAccounts, maxTransactions, maxPositions } = PLANS.free;
  return `Gratuit jusqu’à ${maxAccounts} comptes, ${maxTransactions} transactions et ${maxPositions} positions. Sans carte bancaire.`;
}

// Feature pages whose feature requires the Pro plan (see lib/plans.ts features).
export const PRO_FEATURE_SLUGS: ReadonlySet<string> = new Set(['dividendes', 'import-transactions']);
