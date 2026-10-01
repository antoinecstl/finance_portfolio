export interface NiceYAxisScale {
  domain: [number, number];
  ticks: number[];
  step: number;
}

const NICE_FACTORS = [1, 2.5, 5, 10] as const;

function niceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;

  const exponent = Math.floor(Math.log10(rawStep));
  const magnitude = 10 ** exponent;
  const normalized = rawStep / magnitude;
  const factor = NICE_FACTORS.find((candidate) => normalized <= candidate) ?? 10;

  return factor * magnitude;
}

export function buildNiceYAxisScale(
  values: Array<number | null | undefined>,
  options: { minTickCount?: number; maxTickCount?: number; includeZero?: boolean } = {},
): NiceYAxisScale {
  const finiteValues = values.filter((value): value is number => Number.isFinite(value));

  if (finiteValues.length === 0) {
    return { domain: [0, 1], ticks: [0, 1], step: 1 };
  }

  let min = Math.min(...finiteValues);
  let max = Math.max(...finiteValues);

  if (options.includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }

  if (min === max) {
    const fallbackStep = niceStep(Math.max(Math.abs(min) * 0.2, 1));
    min -= fallbackStep;
    max += fallbackStep;
  }

  const minTickCount = options.minTickCount ?? 4;
  const maxTickCount = options.maxTickCount ?? 6;
  const targetIntervals = Math.max(1, maxTickCount - 1);
  let step = niceStep((max - min) / targetIntervals);
  let domainMin = Math.floor(min / step) * step;
  let domainMax = Math.ceil(max / step) * step;
  let ticks = buildTicks(domainMin, domainMax, step);

  while (ticks.length < minTickCount) {
    step = niceStep(step / 2.1);
    domainMin = Math.floor(min / step) * step;
    domainMax = Math.ceil(max / step) * step;
    ticks = buildTicks(domainMin, domainMax, step);
  }

  return { domain: [domainMin, domainMax], ticks, step };
}

function buildTicks(min: number, max: number, step: number): number[] {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 2);
  const ticks: number[] = [];
  const count = Math.round((max - min) / step);

  for (let index = 0; index <= count; index += 1) {
    ticks.push(Number((min + step * index).toFixed(decimals)));
  }

  return ticks;
}

/** Nombre de repères d'axe X lisibles pour une largeur de graphique donnée. */
export function tickCountForWidth(width: number, minLabelWidth = 96): number {
  if (!Number.isFinite(width) || width <= 0) return 5;
  return Math.max(2, Math.min(9, Math.floor(width / minLabelWidth)));
}

/**
 * Repères d'axe X régulièrement espacés, premier et dernier point inclus.
 * À utiliser avec `interval={0}` : la grille verticale suit exactement ces
 * repères, sans trou irrégulier en fin de graphique (ce que produit
 * `interval="preserveStartEnd"` en forçant le dernier libellé).
 */
export function evenlySpacedTicks<T>(values: readonly T[], count: number): T[] {
  if (values.length <= count) return [...values];
  if (count <= 1) return [values[values.length - 1]];
  const ticks: T[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    const index = Math.round((i * (values.length - 1)) / (count - 1));
    if (!seen.has(index)) {
      seen.add(index);
      ticks.push(values[index]);
    }
  }
  return ticks;
}
