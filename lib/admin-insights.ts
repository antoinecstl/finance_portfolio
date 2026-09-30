/** Helpers purs pour garder les indicateurs du dashboard cohérents et testables. */
export function calculateRate(value: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((value / total) * 100);
}

export function formatAdminRate(value: number, total: number): string {
  const rate = calculateRate(value, total);
  return rate === null ? '—' : `${rate} %`;
}

export function estimateMonthlyRevenue(paidSubscriptions: number, monthlyPriceCents: number): number {
  return Math.max(0, paidSubscriptions) * Math.max(0, monthlyPriceCents);
}
