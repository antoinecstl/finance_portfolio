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
