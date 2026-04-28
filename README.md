# 💼 Fi-Hub — Suivi de patrimoine

Plateforme SaaS de suivi de patrimoine personnel :

- 📊 **Dashboard** — vue d'ensemble (valorisation totale, P&L, répartition)
- 💰 **Comptes multiples** — PEA, CTO, Livret A, LDDS, Assurance-Vie, PEL, autres
- 📈 **Cours en temps réel** — Yahoo Finance (cache 60s)
- 📉 **Graphiques** — répartition par position, par secteur, historique
- 📝 **Transactions & dividendes** — historique complet
- 🔐 **Authentification Supabase** — session + RLS côté DB
- 💳 **Abonnement Pro** — Paddle (Merchant of Record)
- ✉️ **Emails transactionnels** — Resend

## 🚀 Stack

- **Next.js 16** (App Router, route groups)
- **TypeScript** + **Tailwind CSS 4**
- **Supabase** — PostgreSQL + Auth (+ RLS)
- **Paddle** — checkout & abonnements
- **Resend** — emails
- **Recharts** — graphiques

## 📁 Architecture

```
finance_portfolio/
├── app/
│   ├── (app)/                # routes authentifiées (session requise)
│   │   ├── dashboard/
│   │   ├── settings/         # profile, security, billing, danger
│   │   └── layout.tsx
│   ├── (auth)/               # login, signup, forgot/reset-password
│   ├── (marketing)/          # landing publique + legal
│   ├── api/
│   │   ├── account/          # delete, export, onboard
│   │   ├── accounts/         # CRUD comptes
│   │   ├── positions/
│   │   ├── transactions/
│   │   ├── stocks/           # quotes, search, history (Yahoo)
│   │   ├── billing/portal/   # Paddle customer portal
│   │   └── webhooks/paddle/  # webhook signé Paddle
│   ├── auth/callback/        # callback OAuth Supabase
│   ├── layout.tsx
│   ├── robots.ts
│   └── sitemap.ts
├── components/               # UI, modals, tableaux, marketing/
├── lib/
│   ├── auth.tsx              # AuthProvider (contexte session)
│   ├── supabase/             # clients server + middleware
│   ├── stock-api.ts          # Yahoo Finance (fetch timeout + cache)
│   ├── rate-limit.ts         # rate limiter in-memory
│   ├── paddle.ts
│   ├── plans.ts              # FREE / PRO (limites d'usage)
│   ├── portfolio-calculator.ts
│   ├── subscription.ts / subscription-client.tsx
│   ├── transaction-validation.ts
│   ├── email.ts
│   ├── hooks.ts / types.ts / utils.ts
│   └── theme.ts (côté Subleet)
├── middleware.ts             # refresh session Supabase
└── supabase/
    ├── schema.sql
    └── migrations/           # à exécuter dans l'ordre chronologique
```

## ⚙️ Installation

```bash
npm install
cp .env.example .env.local    # puis remplir les valeurs
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

## 🔑 Variables d'environnement

Voir [.env.example](./.env.example). En résumé :

| Variable | Usage |
|---|---|
| `NEXT_PUBLIC_APP_URL` | URL publique (redirects, emails) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client Supabase browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Opérations privilégiées côté serveur |
| `PADDLE_API_KEY` / `PADDLE_WEBHOOK_SECRET` | Paddle server-side |
| `PADDLE_PRO_PRICE_ID` | Prix Pro mensuel (matché dans le webhook) |
| `PADDLE_PRO_YEARLY_PRICE_ID` | Prix Pro annuel (matché dans le webhook) |
| `NEXT_PUBLIC_PADDLE_ENV` | `sandbox` ou `production` |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | Token Paddle.js browser |
| `NEXT_PUBLIC_PADDLE_PRO_PRICE_ID` | Prix mensuel, exposé browser |
| `NEXT_PUBLIC_PADDLE_PRO_YEARLY_PRICE_ID` | Prix annuel, exposé browser |
| `RESEND_API_KEY` / `RESEND_FROM` | Emails transactionnels |

## 🗄️ Base de données

1. Créez un projet Supabase.
2. Dans l'**éditeur SQL**, exécutez dans l'ordre :
   1. `supabase/schema.sql`
   2. `supabase/migration_add_rls.sql` (si pas déjà dans schema)
   3. Tous les fichiers de `supabase/migrations/` par ordre chronologique
3. Dans **Auth > URL Configuration** : ajoutez Site URL + Redirect URLs (incluant `/auth/callback`).
4. Dans **Auth > Email Templates** : branchez SMTP Resend (domaine vérifié requis).

## 📈 Cours boursiers

Récupérés via Yahoo Finance. Les routes `/api/stocks/*` :

- sont **authentifiées** (401 sans session)
- ont un **rate limit** par utilisateur (60 quotes/min, 30 search/min, 20 history/min)
- utilisent **`next: { revalidate: 60 }`** côté fetch → cache 60s Yahoo par symbole
- ont un **timeout** réseau (5s quotes/search, 10s history)

Pour les actions françaises, suffixe `.PA` : `MC.PA` (LVMH), `OR.PA` (L'Oréal), `TTE.PA` (TotalEnergies), `AIR.PA` (Airbus)…

## 🔐 Sécurité

- RLS activé sur toutes les tables portefeuille (`accounts`, `positions`, `transactions`) → un user ne voit que ses données.
- Webhook Paddle signé (`PADDLE_WEBHOOK_SECRET`), exclu du middleware de session.
- Rate limiting in-memory sur `/api/stocks/*` (par user) et pourra être migré vers Upstash/Redis si besoin distribué.

## 🚀 Déploiement (Vercel)

### 1. Projets Supabase séparés dev / prod

`fi-hub-dev` et `fi-hub-prod`. Pour chacun :
1. Migrations dans l'ordre.
2. Auth > URL Configuration : domaine + `/auth/callback`.
3. Auth > Email Templates : SMTP Resend.

### 2. Paddle

1. Compte Paddle (sandbox pour tests, live pour prod).
2. Produit « Fi-Hub Pro » — prix mensuel → `PADDLE_PRO_PRICE_ID` + prix annuel → `PADDLE_PRO_YEARLY_PRICE_ID`.
3. Developer Tools > Notifications : endpoint `https://<domaine>/api/webhooks/paddle` → `PADDLE_WEBHOOK_SECRET`.
4. Authentication > Client-side tokens → `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`.

### 3. Resend

1. Domaine vérifié (`fi-hub.subleet.com`) — SPF + DKIM.
2. Clé API → `RESEND_API_KEY`.

### 4. Vercel

1. Import du repo, framework = Next.js.
2. Toutes les variables de `.env.example` dans Settings > Environment Variables.
3. Région recommandée : `cdg1` (proximité Paddle EU + latence utilisateurs FR).

## CI/CD GitHub Actions

Le workflow principal est dans `.github/workflows/pipeline.yml`.

Sur `pull_request` et `push` vers `main` ou `master`, la CI exécute :

1. `npm ci`
2. `npm run lint`
3. `npm test`
4. `npm run build`

Sur `push` vers `main` ou `master`, le job `Deploy Production (Vercel)` déploie ensuite en production si les secrets GitHub suivants sont configurés :

| Secret GitHub | Usage |
|---|---|
| `VERCEL_TOKEN` | Token Vercel utilisé par la CLI |
| `VERCEL_ORG_ID` | Identifiant de l'équipe ou du compte Vercel |
| `VERCEL_PROJECT_ID` | Identifiant du projet Vercel |

Les variables applicatives restent gérées dans Vercel (`NEXT_PUBLIC_SUPABASE_URL`, `PADDLE_API_KEY`, `RESEND_API_KEY`, etc.). La CI utilise des valeurs factices uniquement pour compiler et tester.

## 📄 Licence

MIT
