type ApiErrorPayload = {
  error?: unknown;
  message?: unknown;
  reason?: unknown;
  issues?: unknown;
};

const ERROR_MESSAGES: Record<string, string> = {
  account_does_not_support_positions: 'Ce compte ne peut pas contenir d’achats, ventes ou dividendes.',
  account_has_positions: 'Ce compte contient déjà une activité titres.',
  asset_account_mismatch: 'Ce titre n’est pas compatible avec le type de compte sélectionné.',
  confirm_mismatch: 'Le nom saisi ne correspond pas au compte.',
  crypto_type_change_forbidden: 'Un compte Crypto ne peut pas être transformé en compte classique, et inversement.',
  deletion_blocked: 'Suppression impossible : elle rendrait l’historique du compte incohérent.',
  fee_child_not_editable: 'Cette ligne de frais est liée à une autre transaction. Modifiez la transaction principale.',
  forbidden_origin: 'Requête refusée pour raison de sécurité. Rechargez la page puis réessayez.',
  internal_error: 'Une erreur serveur est survenue. Réessayez dans quelques instants.',
  invalid_account: 'Compte invalide ou inaccessible.',
  invalid_payload: 'Certaines informations sont invalides. Vérifiez les champs puis réessayez.',
  invalid_state: 'Cette opération rendrait l’historique du compte incohérent.',
  limit_reached: 'Limite atteinte pour votre plan.',
  not_found: 'Élément introuvable ou déjà supprimé.',
  payload_too_large: 'Les données envoyées sont trop volumineuses.',
  unsupported_media_type: 'Format de requête non supporté.',
  unauthorized: 'Votre session a expiré. Reconnectez-vous puis réessayez.',
};

function firstIssueMessage(issues: unknown): string | null {
  if (!Array.isArray(issues)) return null;
  const first = issues[0];
  if (!first || typeof first !== 'object') return null;
  const message = (first as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

export function getApiErrorMessage(
  payload: ApiErrorPayload | null | undefined,
  fallback: string,
  status?: number
): string {
  const reason = typeof payload?.reason === 'string' ? payload.reason.trim() : '';
  if (reason) return reason;

  const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
  if (message) return message;

  const issueMessage = firstIssueMessage(payload?.issues);
  if (issueMessage) return issueMessage;

  const code = typeof payload?.error === 'string' ? payload.error.trim() : '';
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];

  if (status === 401) return ERROR_MESSAGES.unauthorized;
  if (status === 403) return ERROR_MESSAGES.forbidden_origin;
  if (status === 413) return ERROR_MESSAGES.payload_too_large;
  if (status === 415) return ERROR_MESSAGES.unsupported_media_type;
  if (status && status >= 500) return ERROR_MESSAGES.internal_error;

  return fallback;
}
