# CLAUDE.md

Project guide for Claude Code when working in this repository.

## Project

Fi-Hub is a French personal finance and portfolio tracking SaaS.

- Production domain: `https://fi-hub.subleet.com`
- Sitemap: `https://fi-hub.subleet.com/sitemap.xml`
- Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase, Paddle, Vercel Analytics, Vercel Speed Insights, Vitest, ESLint.

## Repository Map

- `app/`: Next.js App Router routes, route groups, API routes, metadata, sitemap, robots.
- `app/(marketing)`: public landing page, legal pages, SEO JSON-LD.
- `app/(auth)`: login, signup, password reset.
- `app/(app)`: authenticated product pages, including settings and billing.
- `components/`: shared UI and marketing components.
- `lib/`: business logic, plan definitions, Supabase clients, Paddle helpers, portfolio calculations, import/export, email.
- `supabase/functions/new-signup-notification`: Supabase Edge Function for signup notifications through Slack/Discord webhooks.
- `marketing/`: launch and marketing notes.

## Common Commands

- `npm run dev`: start the local Next.js dev server.
- `npx tsc --noEmit`: type-check.
- `npm run lint`: run ESLint.
- `npm run build`: production build.
- `npm test`: run Vitest tests.

On Windows, local builds may need:

```powershell
$env:NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS='1'; npm run build
```

If `npm install` hits optional peer dependency conflicts, use `--legacy-peer-deps`. This was needed when adding the Vercel Analytics packages because npm tried to resolve optional Svelte/Vite peers that are not used by this Next.js app.

## Known Local Warnings

- `npm run lint` currently reports an existing warning in `app/(marketing)/page.tsx`: `ENVELOPES` is assigned but unused.
- Local `npm run build` may log `UNABLE_TO_VERIFY_LEAF_SIGNATURE` while fetching static marketing chart data. The build can still pass.

## Environment

Never commit secrets. Important environment variables include:

- `NEXT_PUBLIC_APP_URL`: should be `https://fi-hub.subleet.com` in production.
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_PADDLE_ENV`: `sandbox` or `production`.
- `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`
- `NEXT_PUBLIC_PADDLE_PRO_PRICE_ID`
- `NEXT_PUBLIC_PADDLE_PRO_YEARLY_PRICE_ID`
- `PADDLE_API_KEY`
- `PADDLE_WEBHOOK_SECRET`
- `PADDLE_PRO_PRICE_ID`
- `PADDLE_PRO_YEARLY_PRICE_ID`
- `RESEND_API_KEY` / `RESEND_FROM` for transactional email.
- Supabase Edge Function signup notifications use function secrets such as `SIGNUP_SLACK_WEBHOOK_URL`, `SIGNUP_DISCORD_WEBHOOK_URL`, `APP_URL`, or `NEXT_PUBLIC_APP_URL`.

## App Layout

- Authenticated pages render inside `components/app-shell/AppShell.tsx`, mounted in `app/(app)/layout.tsx`: fixed sidebar from `xl` (1280px), compact top bar + section tabs below.
- Dashboard sections are client-side tabs synced with `?tab=` (`components/app-shell/navigation.ts`); use `navigateToDashboardTab` / `dashboardTabHref` rather than duplicating tab lists.
- New users go through the onboarding tunnel (`components/Onboarding.tsx`, logic in `lib/onboarding.ts`) until `profiles.onboarded_at` is set: profile, first account, first transaction (a purchase is saved with the deposit that funded it), then the optional Pro import. `app/(app)/layout.tsx` resumes at the right step from existing accounts and transactions; `/api/account/onboard` takes `step: 'profile' | 'complete'`.
- Wrap page content in `PageContainer` (shared max width and gutters, so edges align across pages) and start pages with `PageHeader` (`components/app-shell/PageLayout.tsx`). Do not add per-page back links or full-screen backgrounds.

## Market Explorer

- Pages `app/(app)/marches` (home: search, holdings, indices) and `app/(app)/marches/[symbol]` (symbol page: chart, stats, dividends). Spec in `docs/specs/explorateur-marches.md`, competitor notes in `docs/analyses/baggr.md`.
- Routes `app/api/market/{chart,overview,fundamentals,news}` (auth + 60 req/min), backed by `lib/stock-api.ts` (`getMarketChart`, `getFundamentalsSeries`, `getQuoteSummary` with a cookie/crumb session, `getProviderNews`) and `lib/news-feed.ts` (Google News RSS, French). Never name the market data provider in the UI.
- Pure logic (periods, parsing, performance/volatility/drawdown/dividends, recents) lives in `lib/market`; UI in `components/market`.

## Billing and Paddle

- Billing UI lives in `app/(app)/settings/billing`.
- Shared visible plan names, prices, labels, limits, and savings helpers live in `lib/plans.ts`.
- Current Pro messaging:
  - Monthly: `Premier mois gratuit`.
  - Yearly: `-17%` and `2 mois offerts`.
- Paddle price IDs come from env vars, not from `lib/plans.ts`.
- Paddle webhook route: `app/api/webhooks/paddle/route.ts`.
- Paddle server helper: `lib/paddle.ts`.
- Paddle.js must be allowed by CSP in `next.config.ts`: `https://cdn.paddle.com`.

## Supabase

- Browser/server/admin Supabase clients live in `lib/supabase`.
- Do not store app secrets through Postgres `ALTER DATABASE SET app.settings.*` on Supabase hosted projects.
- Use Supabase Edge Function secrets for function configuration.
- The signup notification system is implemented as a Supabase Edge Function under `supabase/functions/new-signup-notification`.
- Prefer selecting the Edge Function directly in the Supabase Dashboard Auth Hook UI when available.

## Public API and AI Plugins

- Pro-only (`api_access` feature in `lib/plans.ts`, enforced in Postgres through `public.user_has_pro_access`). Read-only access for AI assistants and scripts.
- Two ways to authenticate, both sending `Authorization: Bearer fih_...`:
  - Personal tokens created/revoked in `app/(app)/settings/api` (routes `app/api/api-tokens`).
  - OAuth 2.1 (PKCE S256, dynamic client registration) for Claude/ChatGPT connectors: metadata in `app/.well-known/*`, consent screen `app/oauth/authorize`, endpoints `app/api/oauth/{register,token,revoke,authorize}`. Access tokens last 1 h, refresh tokens 60 days with rotation. OAuth grants are `api_tokens` rows with `kind = 'oauth'`.
- Only SHA-256 hashes of tokens, codes and secrets are stored (migrations `20260930_api_tokens.sql`, `20261001_public_api_hardening.sql`).
- REST: `app/api/v1/*` (`me`, `portfolio`, `accounts`, `positions`, `transactions`), OpenAPI 3.1 spec at `/api/v1/openapi.json` for ChatGPT GPT Actions. MCP: stateless Streamable HTTP JSON-RPC server at `/api/mcp`.
- Data isolation lives in Postgres: the app passes the bearer token to `security definer` functions (`api_authenticate`, `api_accounts`, `api_transactions`, `api_profile`) that resolve the owner themselves. They are executable by `service_role` only. Never read user data for the public API with a `user_id` coming from application code.
- Rate limits are shared across instances in Postgres (`api_rate_limits` + `api_rate_limit_hit`): 60 req/min per token, plus per-IP limits on OAuth registration and token endpoints.
- Logic lives in `lib/public-api`.

## SEO and Analytics

- Google Search site name is intended to be `fi-hub.subleet.com`.
- Keep `WebSite` JSON-LD on the marketing homepage aligned with `openGraph.siteName`.
- Vercel Analytics and Speed Insights are mounted globally in `app/layout.tsx`.
- Vercel dev analytics scripts are allowed in CSP through `https://va.vercel-scripts.com`.
- `app/sitemap.ts` and `app/robots.ts` use `NEXT_PUBLIC_APP_URL`.

## Development Guidelines

- Preserve existing App Router server/client boundaries.
- Prefer shared constants and helpers already in `lib/` over duplicating business rules in UI components.
- Keep pricing and plan copy centralized in `lib/plans.ts` where possible.
- Do not revert unrelated uncommitted changes.
- For code changes, run at least `npx tsc --noEmit`; add lint/build/tests depending on the risk and touched files.
- Keep changes focused. Avoid unrelated refactors when fixing production issues.
