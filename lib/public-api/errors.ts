/** Erreur dont le message peut être renvoyé tel quel au client de l'API. */
export class PublicApiError extends Error {
  constructor(
    public readonly code: 'internal_error' | 'not_found' | 'invalid_cursor',
    message: string
  ) {
    super(message);
  }
}
