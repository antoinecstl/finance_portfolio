// Saisie des montants à la française : « 1 234,56 » comme « 1234.56 ».
// Les champs restent du texte (inputMode="decimal") : un champ type=number
// refuse la virgule sur une partie des téléphones et navigateurs.

/** Nombre lu dans une saisie libre ; NaN si la saisie n'est pas un nombre. */
export function parseDecimal(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value;
  if (!value) return NaN;
  const cleaned = value.replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return NaN;
  return Number(cleaned);
}

/** Valeur à mettre dans un champ, avec la virgule décimale (« 744,80 »). */
export function formatDecimalInput(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(digits).replace('.', ',');
}
