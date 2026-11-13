// Messages d'erreur d'authentification en français. Le fournisseur renvoie des
// messages techniques en anglais (« User already registered ») : on les traduit
// par code d'erreur, puis par motif pour les versions sans code.

type AuthErrorLike = { code?: unknown; message?: unknown; status?: unknown } | null | undefined;

const BY_CODE: Record<string, string> = {
  user_already_exists: 'Un compte existe déjà avec cette adresse. Connectez-vous ou réinitialisez votre mot de passe.',
  email_exists: 'Un compte existe déjà avec cette adresse. Connectez-vous ou réinitialisez votre mot de passe.',
  weak_password: 'Ce mot de passe est trop fragile ou déjà compromis. Choisissez-en un plus long et unique.',
  email_address_invalid: 'Cette adresse email n’est pas valide.',
  email_address_not_authorized: 'Cette adresse email n’est pas acceptée. Essayez-en une autre.',
  validation_failed: 'Vérifiez votre adresse email et votre mot de passe.',
  signup_disabled: 'Les inscriptions sont momentanément fermées. Réessayez plus tard.',
  over_email_send_rate_limit: 'Trop d’emails envoyés à cette adresse. Patientez quelques minutes avant de réessayer.',
  over_request_rate_limit: 'Trop de tentatives. Patientez quelques minutes avant de réessayer.',
  captcha_failed: 'La vérification anti-robot a échoué. Rechargez la page puis réessayez.',
  email_not_confirmed: 'Confirmez votre adresse via l’email reçu avant de vous connecter.',
  same_password: 'Le nouveau mot de passe doit être différent de l’ancien.',
};

const BY_PATTERN: Array<[RegExp, string]> = [
  [/already registered|already exists/i, BY_CODE.user_already_exists],
  [/password.*(at least|should be|weak|pwned|leaked)/i, BY_CODE.weak_password],
  [/invalid.*email|email.*invalid/i, BY_CODE.email_address_invalid],
  [/rate limit|too many|security purposes/i, BY_CODE.over_request_rate_limit],
  [/signups? not allowed|signup.*disabled/i, BY_CODE.signup_disabled],
  [/captcha/i, BY_CODE.captcha_failed],
  [/not confirmed/i, BY_CODE.email_not_confirmed],
];

export function authErrorMessage(
  error: AuthErrorLike,
  fallback = 'Une erreur est survenue. Réessayez dans quelques instants.'
): string {
  const code = typeof error?.code === 'string' ? error.code : '';
  if (code && BY_CODE[code]) return BY_CODE[code];

  const message = typeof error?.message === 'string' ? error.message : '';
  for (const [pattern, text] of BY_PATTERN) {
    if (pattern.test(message)) return text;
  }
  if (error?.status === 429) return BY_CODE.over_request_rate_limit;
  return fallback;
}
