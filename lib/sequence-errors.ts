export function formatInvalidAccountSequenceMessage(message: string): string {
  const cashWithCurrency = message.match(
    /INVALID_ACCOUNT_SEQUENCE:\s*cash_negative_([A-Z0-9]+)\s+at\s+(\d{4}-\d{2}-\d{2})/i
  );
  if (cashWithCurrency) {
    const currency = cashWithCurrency[1].toUpperCase();
    const date = cashWithCurrency[2];
    return `Solde ${currency} insuffisant au ${date}. Ajoutez avant cette date un depot ou une conversion qui credite ${currency}, ou corrigez la devise/le montant de la ligne d'achat.`;
  }

  const cash = message.match(
    /INVALID_ACCOUNT_SEQUENCE:\s*cash_negative\s+at\s+(\d{4}-\d{2}-\d{2})/i
  );
  if (cash) {
    const date = cash[1];
    return `Solde cash insuffisant au ${date}. Ajoutez un depot anterieur ou corrigez la transaction qui debite le compte.`;
  }

  const shares = message.match(
    /INVALID_ACCOUNT_SEQUENCE:\s*shares_negative\s+([A-Z0-9.\-]+)\s+at\s+(\d{4}-\d{2}-\d{2})/i
  );
  if (shares) {
    const symbol = shares[1].toUpperCase();
    const date = shares[2];
    return `Position ${symbol} insuffisante au ${date}. Ajoutez un achat anterieur ou corrigez la quantite vendue.`;
  }

  return message;
}
