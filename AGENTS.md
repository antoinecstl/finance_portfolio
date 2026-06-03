<claude-mem-context>
# Memory Context

# [finance_portfolio] recent context, 2026-06-03 2:06am GMT+2

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (23 552t read) | 842 149t work | 97% savings

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
### Jun 3, 2026
673 1:40a 🔵 Windows Sandbox Spawn Failure Blocking All Shell Commands
674 " 🔵 Crypto Positions Tracked Per (Symbol, Currency) Pair — Consolidation Needed
675 " 🔵 Transaction Time Field Architecture for Same-Day Ordering
676 1:41a 🔵 Key Files Identified for Both Fix Tasks
677 " 🔵 Time Picker Uses Native HTML Input Type="time" — Identified as Mobile Bug Source
692 1:48a 🔵 finance_portfolio: Positions Derived Entirely from Transactions (No DB Positions Table)
693 " 🔵 finance_portfolio: Multi-Currency Position Tracking Architecture
694 " 🔵 finance_portfolio: Transaction Modals Implement Client-Side Sell Validation Against Calculated Positions
695 " 🔵 finance_portfolio: Stock Quote API Uses Yahoo Finance Chart Endpoint with 5s Timeout
691 " 🔵 Finance Portfolio App: Position & Quote Architecture Mapped
696 1:49a ⚖️ Planned: Crypto Position Consolidation and Responsive Modal Grid Fixes
697 1:50a 🔵 finance_portfolio: FX Conversion Uses EURUSD=X Convention with Stablecoin Peg Table
698 1:51a 🔵 finance_portfolio: Existing Test Coverage for Crypto/Account Type Utilities in lib/utils.test.ts
699 1:52a 🔵 Portfolio Analysis Component — Multi-Currency & Pro Feature Architecture
700 1:53a 🟣 Added lib/position-display.ts: Crypto-Aware Position Display Grouping
701 1:54a 🔄 Charts.tsx PositionPerformanceChart Now Uses buildPositionDisplayGroups for Crypto Consolidation
702 " 🔴 Charts.tsx patch conflict: apply_patch failed on metrics refactor, import-only patch applied successfully
704 1:55a 🔵 Charts.tsx metrics block was still using old positions.map() after partial patches
705 1:58a 🔄 Charts.tsx Metrics Refactored to Use buildPositionDisplayGroups Output
706 2:04a 🔴 Responsive Grid Layout Fixed in EditTransactionModal
707 " 🟣 Unit Tests Added for Crypto Pair Helpers and Position Display Grouping

Access 842k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>