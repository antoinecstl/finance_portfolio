<claude-mem-context>
# Memory Context

# [finance_portfolio] recent context, 2026-05-13 3:12pm GMT+2

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (19 049t read) | 667 946t work | 97% savings

### May 6, 2026
S2 Fix progress bar alignment in portfolio mockup (May 6, 11:31 PM)
S1 Replace fixed type-priority transaction ordering with optional explicit time field (HH:MM) so users can control same-day transaction order, affecting PRU and cash replay calculations (May 6, 11:31 PM)
S3 Fix misaligned progress bars in portfolio mockup on landing page—bars should align with each other, not with adjacent numbers (May 6, 11:37 PM)
### May 8, 2026
44 12:00a 🔵 Lint Passes with One Unused Variable Warning
### May 11, 2026
77 10:25p 🟣 Free First Month for New Subscriptions
78 10:31p ⚖️ One-Month Trial Period Restricted to Monthly Plan Only
79 10:48p 🟣 Marketing Landing & Billing Page Upgrade for Free Users
80 " 🔵 Pricing & Billing Page Architecture Mapped
81 10:52p 🟣 Pricing UI enhanced with trial and savings labels sourced from shared constants
82 10:54p 🟣 Billing settings upgrade prompt redesigned into a rich three-panel section
83 " 🟣 BillingActions.tsx interval toggle and CTA button updated with trial and savings labels
84 10:55p 🟣 Billing & Marketing Pages Updated with Trial/Value Messaging
85 11:02p ✅ Copy update: "un mois gratuit" → "premier mois gratuit"
86 " 🟣 Centralized pricing label constants + billing/marketing UI overhaul
87 " ✅ MONTHLY_TRIAL_LABEL updated to 'Premier mois gratuit'
88 " 🔵 Windows dev environment: TLS cert verification fails for stock chart API during Next.js build
89 11:05p 🟣 Vercel Analytics and Speed Insights integrated into layout
90 " 🔵 CSP in next.config.ts blocks third-party scripts by default
91 11:09p 🟣 Vercel Analytics and Speed Insights integrated into Fi-Hub
92 " 🔵 Local build SSL errors on stock chart fetches — UNABLE_TO_VERIFY_LEAF_SIGNATURE
### May 12, 2026
93 10:19p 🔵 Google Indexes Root Domain Instead of Subdomain for fi-hub
94 " 🔵 Marketing Landing Page Uses Hardcoded SITE_URL Pointing to fi-hub.subleet.com
95 10:20p 🔵 metadataBase Is Correctly Set to fi-hub.subleet.com in Root Layout — Google Issue Is Not a Code Problem
96 " ✅ OpenGraph siteName Changed to Subdomain String to Influence Google Search Appearance
97 10:22p ✅ SEO: Google site name updated from "Fi-Hub" to "fi-hub.subleet.com"
98 10:58p ✅ Removed Yahoo references from SEO metadata in fi-hub finance portfolio
99 11:03p 🔵 No CLAUDE.md found in finance_portfolio; AGENTS.md exists at project root
100 11:07p 🔵 finance_portfolio Codebase Structure Mapped
101 " 🔵 Codebase Quality Scan: No Tech Debt Markers; Inconsistent Barrel Exports
102 11:08p 🔵 Full External Service Integration Surface Documented in .env.example
103 " 🔵 Likely Typo in LLM Default Model: 'gpt-5.4-nano' Does Not Exist
104 " 🔵 Several Components Are Extremely Large Files — Refactoring Candidates
105 11:09p 🔵 Largest Files by Line Count Identified; Barrel Export Gap Confirmed as Intentional
106 11:10p 🔵 Domain Model: French Account Types, Multi-Currency Transactions, and CONVERSION Transaction Type
107 " 🔵 lib/utils.ts API Surface and Migration History Mapped
108 " 🔵 AddTransactionModal Uses Granular useState Per Field — Explains 859-Line Size
109 11:11p 🔵 ProBlur Uses Server-Side Fake Placeholder to Prevent DevTools Paywall Bypass
110 " 🔵 Two Unused Dependencies Identified: pdf-parse and @napi-rs/canvas
111 11:12p 🔵 Two Dead Exports in lib/utils.ts: getTransactionColor and CHART_COLORS
112 " 🔵 Refined: CHART_COLORS Is Internal-Only (Used by getSectorColor); getTransactionColor Truly Dead
113 " 🔵 Charts.tsx Contains 7 Fully Distinct Components — Clear Split Target
114 11:13p 🔵 API Route Map: 17 Routes with Notable account/ vs accounts/ Naming Split
115 " 🔵 Comprehensive Cleanup Analysis Completed by Explore Sub-Agent
S8 Global codebase analysis and cleanup of finance_portfolio (Fi-Hub) Next.js app (May 12, 11:14 PM)
116 11:14p 🟣 CLAUDE.md Created for finance_portfolio (Fi-Hub)
### May 13, 2026
117 12:16a ✅ Removed all Yahoo mentions from the project
118 " 🔄 Extracted shared IdRouteContext type and cleaned up TypeScript types
119 12:19a 🔄 Codebase Cleanup: Dead Dependencies, Unused Export, Type Deduplication
132 12:29a ✅ Removed Yahoo References Project-Wide
135 12:30a 🔄 Extracted Shared `IdRouteContext` Type into `lib/route-types.ts`
136 " 🔄 Renamed Ambiguous `PaddleEvent` Types to Context-Specific Names
137 " 🔄 Removed Dead `getTransactionColor` Export from `lib/utils.ts`
138 " ✅ Removed `pdf-parse`, `@napi-rs/canvas`, and `@types/pdf-parse` Dependencies
139 " 🔵 Post-Cleanup Build and Test Verification: All Green

Access 668k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>