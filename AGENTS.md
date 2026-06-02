<claude-mem-context>
# Memory Context

# [finance_portfolio] recent context, 2026-06-02 9:40pm GMT+2

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (23 308t read) | 590 785t work | 96% savings

### May 6, 2026
S2 Fix progress bar alignment in portfolio mockup (May 6, 11:31 PM)
S1 Replace fixed type-priority transaction ordering with optional explicit time field (HH:MM) so users can control same-day transaction order, affecting PRU and cash replay calculations (May 6, 11:31 PM)
S3 Fix misaligned progress bars in portfolio mockup on landing page—bars should align with each other, not with adjacent numbers (May 6, 11:37 PM)
S8 Global codebase analysis and cleanup of finance_portfolio (Fi-Hub) Next.js app (May 6, 11:38 PM)
### May 12, 2026
S11 RGPD/GDPR compliance audit of Fi-Hub (finance_portfolio Next.js app) — full codebase review (May 12, 11:14 PM)
### May 13, 2026
S12 Mise à jour de la stratégie de campagne de lancement Fi-Hub pour refléter les actions déjà réalisées le 13 mai 2026 (posts LinkedIn, Instagram, TikTok sur le compte Subleet) (May 13, 5:06 PM)
S13 Social media content strategy for Fi-Hub (fi-hub.subleet.com) — Reddit posts + TikTok/Instagram POV scripts to showcase investment performance and grow product awareness organically (May 13, 7:09 PM)
S14 User asked Claude to log into fi-hub.subleet.com and explore stats — credentials were shared in plain text in the session (May 13, 7:51 PM)
S15 Exploration complète du portfolio fi-hub.subleet.com (antoinecstl@gmail.com) — login automatisé + extraction de toutes les stats financières + génération de contenu Reddit/TikTok/Instagram pour promouvoir fi-hub (May 13, 8:19 PM)
### May 20, 2026
348 12:33p 🟣 SEO Architecture Sprint: New Semantic URL Routes, Components, and Sitemap
349 " 🔄 Marketing Landing Page Decoupled from Live Stock API
350 " 🟣 Noindex Applied to All Private/Auth App Layouts
351 " ✅ Legacy SEO URL Redirects and Internal Link Restructuring
353 12:37p 🟣 Multi-Sprint SEO Infrastructure Implemented for Next.js Marketing Site
354 " 🔵 Node.js EPERM on `lstat 'C:\Users\antoi'` Blocks Direct `npm run dev` in Sandbox
355 12:38p 🔵 SEO Architecture Audit Initiated for Next.js Marketing App
356 12:39p 🟣 Full SEO Architecture Implementation Across 4 Sprints
357 " 🔵 Build Blocked by Unrelated Remotion Subproject Missing Dependencies
358 " 🔵 Node.js EPERM lstat Error Blocks Sandboxed npm Commands on Windows
359 2:27p 🟣 Marketing Feature Pages: Platform Mock-ups with Fake Data Requested
360 2:28p ⚖️ Marketing Mock-up Implementation Plan Defined (4 Steps)
361 " 🔵 Platform Component Audit for Marketing Mock-ups: 6 Key Views Identified
362 2:30p 🟣 Marketing Feature Mockups with Fake Data Added to /fonctionnalites Pages
363 " 🔵 Sandbox EPERM Blocks npm/Node Commands in finance_portfolio Worktree
364 2:31p 🟣 Created components/marketing/FeatureMockups.tsx with 4 Fake-Data Platform Mock-ups
365 " 🟣 SeoArticlePage.tsx Wired to Render Feature Mock-ups on Fonctionnalités Pages
366 " 🔵 Windows EPERM lstat Error Blocks npm Scripts Without Escalated Sandbox Permissions
367 " ✅ SEO Copy for import-transactions Feature Page Updated to Highlight AI
368 2:32p ✅ Homepage Import Section Copy Updated to Surface AI, ImportMockup Enhanced with AI Badges
369 2:43p ✅ Marketing Landing Page UI Feedback & Screenshot Migration Plan
370 2:47p 🟣 Replaced coded mockups with real product screenshots
371 " ✅ Renamed "Suivi PEA" feature to "Positions et PRU" across codebase
372 3:06p 🔵 SEO Architecture Audit Initiated on Next.js Marketing App
373 3:13p 🔵 Next.js Build Fails Due to Remotion Config Included in TypeScript Compilation
374 3:15p 🔴 Next.js Prod Build Failing Due to Remotion Project Tracked in Git
375 " 🔵 marketing/fi-hub-videos Is a Separate Remotion Project Nested in the Next.js Repo
376 3:16p 🔵 `.gitignore` Typo: `.marketing/*` Instead of `/marketing/`
377 " 🔴 Fixed CI Build: Untracked `marketing/fi-hub-videos/` from Git and TypeScript
378 " 🔵 Production Build Passes: 47 Routes, TypeScript Clean
### May 21, 2026
479 10:12p 🔵 Fi-Hub SEO Problem: Subdomain Not Ranking for Brand Queries
481 10:13p 🔵 Fi-Hub SEO Architecture: lib/seo-pages.ts + indexableMarketingRoutes
493 10:23p 🔵 Fi-Hub SEO Visibility Problem on Subdomain fi-hub.subleet.com
494 " 🟣 Fi-Hub SEO Brand Name Fixes Applied to layout.tsx and marketing page
500 10:40p 🟣 Codex Skill Installation: anthropics/claude-code frontend-design plugin
501 10:41p 🔵 Codex Skill Installer System Located and Documented
502 10:42p 🔴 frontend-design Skill Install Failed Twice Before Succeeding with Correct Path
503 " 🟣 frontend-design Skill Installed in Codex from anthropics/claude-code
### Jun 2, 2026
642 7:19p 🔵 finance_portfolio Project Structure Identified
644 " 🔵 Currency Handling Code Map: Key Patterns and Potential Bug Sources
645 7:20p 🔵 Position Currency Source-of-Truth Bug: DB Stores EUR by Default Even for USD Assets
646 7:21p 🔵 Root Cause Confirmed: Position Currency Bug in Portfolio Calculator and Missing Account Currency UI
649 " 🔵 PRU Display Bug Root Cause: average_price in EUR Displayed Under quote.currency (USD)
650 7:22p 🔵 Test Coverage Gap Confirmed: No Tests for EUR Position Displayed as USD Bug Scenario
653 " 🔵 Historical EUR Backfill Confirmed: stock_positions Table Dropped, Migration Added currency DEFAULT 'EUR'
655 " 🔵 Dashboard Data Flow Confirmed: Positions Derived From Transactions, FX Rates From Portfolio History
656 7:23p 🔵 PositionsTable Closed Positions: Currency Label from Last SELL, Amounts from BUY — Same Cross-Currency Mismatch
657 7:26p 🔵 Potential Currency Mismatch Bug in Transaction Forms
658 9:03p ⚖️ Mixed-Currency Positions: "Separate Lines" Architecture Chosen
659 " 🔵 Root Cause: Quote Currency Overrides Transaction Currency in Position Display

Access 591k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>