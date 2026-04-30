import 'server-only';

const RESEND_API = 'https://api.resend.com/emails';

function getFrom(): string {
  return process.env.RESEND_FROM || 'Fi-Hub <noreply@fi-hub.subleet.com>';
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://fi-hub.subleet.com';
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY missing — skipping send');
    return;
  }

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getFrom(),
      to: [params.to],
      subject: params.subject,
      html: params.html,
      reply_to: params.replyTo,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[email] Resend failed:', res.status, body);
  }
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f7f2e8;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0e0c0a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;background:#f7f2e8">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#efe7d4;border-radius:8px;border:1px solid #d8cdb6;overflow:hidden">
        <tr><td style="padding:24px 32px;border-bottom:1px solid #d8cdb6">
          <strong style="font-size:18px;color:#0e0c0a">Fi-Hub</strong>
        </td></tr>
        <tr><td style="padding:32px;line-height:1.5;font-size:15px">${body}</td></tr>
        <tr><td style="padding:16px 32px;background:#e6dcc4;border-top:1px solid #d8cdb6;font-size:12px;color:#5b524a">
          Fi-Hub — Suivez votre patrimoine sans Excel.<br>
          <a href="${appUrl()}" style="color:#b91c1c;text-decoration:none">${appUrl()}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendWelcome(to: string): Promise<void> {
  const html = layout(
    'Bienvenue sur Fi-Hub',
    `<h1 style="margin:0 0 16px;font-size:22px">Bienvenue sur Fi-Hub 👋</h1>
    <p>Votre compte est prêt. Vous pouvez commencer à ajouter votre premier compte (PEA, CTO, livret…) et suivre votre patrimoine.</p>
    <p style="margin:24px 0">
      <a href="${appUrl()}/dashboard" style="display:inline-block;padding:10px 20px;background:#0e0c0a;color:#f7f2e8;text-decoration:none;border-radius:8px;font-weight:500">Accéder au dashboard</a>
    </p>
    <p style="color:#5b524a;font-size:13px">Le plan Free inclut 1 compte, 50 transactions et 5 positions. Passez Pro à tout moment pour lever les limites.</p>`
  );
  await sendEmail({ to, subject: 'Bienvenue sur Fi-Hub', html });
}

export async function sendSubscriptionReceipt(to: string, periodEnd: string | null): Promise<void> {
  const endStr = periodEnd
    ? new Date(periodEnd).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'la prochaine échéance';
  const html = layout(
    'Abonnement Pro activé',
    `<h1 style="margin:0 0 16px;font-size:22px">Merci pour votre abonnement 🎉</h1>
    <p>Votre abonnement <strong>Fi-Hub Pro</strong> est actif. Toutes les fonctionnalités Pro sont débloquées : analyses avancées, historique complet, module dividendes, export CSV.</p>
    <p>Prochain renouvellement : <strong>${endStr}</strong>.</p>
    <p style="margin:24px 0">
      <a href="${appUrl()}/settings/billing" style="display:inline-block;padding:10px 20px;background:#0e0c0a;color:#f7f2e8;text-decoration:none;border-radius:8px;font-weight:500">Gérer l'abonnement</a>
    </p>`
  );
  await sendEmail({ to, subject: 'Abonnement Pro activé — Fi-Hub', html });
}

export async function sendPaymentFailed(to: string): Promise<void> {
  const html = layout(
    'Problème de paiement',
    `<h1 style="margin:0 0 16px;font-size:22px">Paiement en échec</h1>
    <p>Nous n'avons pas pu prélever votre abonnement Fi-Hub Pro. Merci de mettre à jour votre moyen de paiement pour éviter l'interruption du service.</p>
    <p style="margin:24px 0">
      <a href="${appUrl()}/settings/billing" style="display:inline-block;padding:10px 20px;background:#b91c1c;color:#f7f2e8;text-decoration:none;border-radius:8px;font-weight:500">Mettre à jour le paiement</a>
    </p>`
  );
  await sendEmail({ to, subject: 'Action requise — paiement Fi-Hub', html });
}

export async function sendAccountDeletion(to: string): Promise<void> {
  const html = layout(
    'Compte supprimé',
    `<h1 style="margin:0 0 16px;font-size:22px">Compte supprimé</h1>
    <p>Votre compte Fi-Hub et l'ensemble de vos données associées ont été définitivement supprimés, conformément au RGPD.</p>
    <p>Si ce n'est pas vous qui avez demandé cette suppression, contactez-nous immédiatement à <a href="mailto:support@fi-hub.subleet.com">support@fi-hub.subleet.com</a>.</p>`
  );
  await sendEmail({ to, subject: 'Votre compte Fi-Hub a été supprimé', html });
}
