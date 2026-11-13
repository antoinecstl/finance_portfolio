// Helpers de pagination cursor-based.
// Le cursor est opaque côté client (base64 d'un tuple { date, effective_time, id }
// encodé en JSON). Avantage vs offset : tenant stable même si de nouvelles lignes
// sont insérées en tête.
//
// effective_time est la colonne générée côté DB qui combine la time saisie et
// l'heure synthétique du type. On l'inclut dans le cursor pour conserver l'ordre
// de tri secondaire entre transactions du même jour.

export type Cursor = { date: string; effective_time: string; id: string };

const CURSOR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURSOR_TIME = /^\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/;
const CURSOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCursor(c: Cursor): string {
  // base64url pour éviter les +/= dans les URLs.
  const json = JSON.stringify(c);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(json).toString('base64url');
  }
  // Fallback navigateur
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCursor(raw: string | undefined | null): Cursor | null {
  if (!raw) return null;
  try {
    const json =
      typeof Buffer !== 'undefined'
        ? Buffer.from(raw, 'base64url').toString('utf-8')
        : atob(raw.replace(/-/g, '+').replace(/_/g, '/'));
    const obj = JSON.parse(json);
    // Les champs sont insérés dans un filtre PostgREST `.or()` : formats stricts,
    // pour qu'un cursor forgé ne puisse pas y ajouter ses propres conditions.
    if (
      obj &&
      typeof obj.date === 'string' &&
      CURSOR_DATE.test(obj.date) &&
      typeof obj.effective_time === 'string' &&
      CURSOR_TIME.test(obj.effective_time) &&
      typeof obj.id === 'string' &&
      CURSOR_ID.test(obj.id)
    ) {
      return { date: obj.date, effective_time: obj.effective_time, id: obj.id };
    }
    return null;
  } catch {
    return null;
  }
}
