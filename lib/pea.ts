// Suivi propre au PEA : plafond de versements et antériorité fiscale de 5 ans.
//
// - Le plafond (150 000 € pour un PEA classique) porte sur le cumul des
//   versements depuis l'ouverture ; un retrait ne redonne pas de capacité.
// - L'antériorité se compte depuis la date d'ouverture du plan. Avant 5 ans, un
//   retrait entraîne en principe sa clôture ; après, les retraits sont libres
//   et les gains exonérés d'impôt sur le revenu (prélèvements sociaux dus).
//
// La date d'ouverture est déclarée par l'utilisateur (accounts.opened_on) : la
// première opération saisie dans Fi-Hub n'est pas une date d'ouverture fiable.

export const PEA_DEPOSIT_CAP = 150_000;
export const PEA_TAX_YEARS = 5;

export interface PeaStatus {
  /** Cumul des versements saisis sur le compte, en euros. */
  deposits: number;
  cap: number;
  remaining: number;
  /** Part du plafond utilisée, de 0 à 100. */
  capUsedPercent: number;
  capReached: boolean;
  openedOn: string | null;
  /** Date des 5 ans (YYYY-MM-DD), si la date d'ouverture est connue. */
  fiveYearDate: string | null;
  fiveYearsReached: boolean | null;
  /** Mois entiers restant avant les 5 ans ; 0 si atteints, null si inconnus. */
  monthsToFiveYears: number | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Ajoute des années à une date YYYY-MM-DD (29 février → 28 février). */
export function addYears(date: string, years: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y + years, m - 1, d));
  // Débordement de mois (29/02 d'une année bissextile) : dernier jour du mois visé.
  if (target.getUTCMonth() !== m - 1) target.setUTCDate(0);
  return target.toISOString().slice(0, 10);
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const months = (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
  return Math.max(0, months);
}

export function sumPeaDeposits(
  transactions: ReadonlyArray<{ account_id: string; type: string; amount: number | string }>,
  accountId: string
): number {
  let total = 0;
  for (const tx of transactions) {
    if (tx.account_id === accountId && tx.type === 'DEPOSIT') total += Number(tx.amount) || 0;
  }
  return Math.round(total * 100) / 100;
}

export function computePeaStatus(input: { deposits: number; openedOn?: string | null; today: string }): PeaStatus {
  const deposits = Math.max(0, input.deposits);
  const openedOn = input.openedOn && ISO_DATE.test(input.openedOn) ? input.openedOn : null;
  const fiveYearDate = openedOn ? addYears(openedOn, PEA_TAX_YEARS) : null;
  const fiveYearsReached = fiveYearDate ? input.today >= fiveYearDate : null;
  return {
    deposits,
    cap: PEA_DEPOSIT_CAP,
    remaining: Math.max(0, PEA_DEPOSIT_CAP - deposits),
    capUsedPercent: Math.min(100, (deposits / PEA_DEPOSIT_CAP) * 100),
    capReached: deposits >= PEA_DEPOSIT_CAP,
    openedOn,
    fiveYearDate,
    fiveYearsReached,
    monthsToFiveYears: fiveYearDate ? (fiveYearsReached ? 0 : monthsBetween(input.today, fiveYearDate)) : null,
  };
}

/** « dans 3 ans et 2 mois », « dans 4 mois », « dans moins d'un mois ». */
export function formatMonthsRemaining(months: number): string {
  if (months <= 0) return 'dans moins d’un mois';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearPart = years > 0 ? `${years} an${years > 1 ? 's' : ''}` : '';
  const monthPart = rest > 0 ? `${rest} mois` : '';
  return `dans ${[yearPart, monthPart].filter(Boolean).join(' et ')}`;
}
