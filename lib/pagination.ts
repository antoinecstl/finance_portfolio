// Helpers de pagination cursor-based.
// Le cursor est opaque côté client (base64 d'un tuple { date, id } encodé en JSON).
// Avantage vs offset : tenant stable même si de nouvelles lignes sont insérées en tête.

export type Cursor = { date: string; id: string };

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
    if (obj && typeof obj.date === 'string' && typeof obj.id === 'string') {
      return obj as Cursor;
    }
    return null;
  } catch {
    return null;
  }
}
