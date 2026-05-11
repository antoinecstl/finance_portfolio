# new-signup-notification

Edge Function Supabase appelee par un Database Webhook Dashboard.

Elle envoie une notification mobile quand une ligne est inseree dans `public.profiles`.
Le profil est cree automatiquement par le trigger existant `auth.users -> profiles`.
Canaux supportes: Slack, ntfy, Telegram, Discord.

## Deploiement

```bash
supabase functions deploy new-signup-notification --no-verify-jwt
supabase secrets set SIGNUP_NOTIFICATION_SECRET="<long-random-secret>"
supabase secrets set SIGNUP_SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
```

Ou fais la meme chose depuis `Edge Functions > Secrets` dans le Dashboard.

## Webhook Supabase Dashboard

Dans `Database > Webhooks`, cree un webhook:

- Name: `new-signup-notification`
- Table: `public.profiles`
- Events: `Insert`
- Type: `HTTP Request`
- Method: `POST`
- URL: `https://<project-ref>.supabase.co/functions/v1/new-signup-notification`
- Headers:
  - `Content-Type`: `application/json`
  - `Authorization`: `Bearer <same value as SIGNUP_NOTIFICATION_SECRET>`

La fonction recoit l'id du profil, recupere l'email dans Supabase Auth avec
`SUPABASE_SERVICE_ROLE_KEY` (secret fourni automatiquement aux Edge Functions),
puis poste le message Slack.

## Alternatives

ntfy:

```bash
supabase secrets set SIGNUP_NTFY_TOPIC="fi-hub-signups-<random>"
supabase secrets set SIGNUP_NTFY_SERVER="https://ntfy.sh"
supabase secrets set SIGNUP_NTFY_PRIORITY="4"
```

Telegram:

```bash
supabase secrets set SIGNUP_TELEGRAM_BOT_TOKEN="<bot-token>"
supabase secrets set SIGNUP_TELEGRAM_CHAT_ID="<chat-id>"
```

Discord:

```bash
supabase secrets set SIGNUP_DISCORD_WEBHOOK_URL="<webhook-url>"
```
