<claude-mem-context>
# Memory Context

# [finance_portfolio] recent context, 2026-05-12 10:21pm GMT+2

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (21 029t read) | 842 694t work | 98% savings

### May 6, 2026
2 10:57p 🔵 Existing Transaction Ordering System: Fixed Type-Priority + created_at Fallback
3 10:58p 🔵 Full Transaction System Architecture Mapped Before Ordering Refactor
4 " 🔵 compareTransactionSequence Used in Four lib/ Modules — Full Impact Scope
5 " 🔵 useTransactions Hook Orders Only by date DESC — Missing Secondary Sort Key
6 10:59p 🔵 Exploration Subagent Confirms: Display Order vs Validation Order Are Inconsistent — And Snapshots Break on Retroactive Reordering
7 11:06p ⚖️ Design Choice Pending: Time Field vs Explicit order_index for Same-Day Transaction Ordering
8 11:10p ⚖️ Implementation Plan Written: Optional time Field with Synthetic Fallback for Same-Day Transaction Ordering
9 11:16p ⚖️ Plan Approved and Execution Started: Optional time Field for Transaction Ordering
10 11:17p 🔵 rebuild_stock_position Uses Simplified Priority (SELL=0, BUY=2) — Diverges from Main Validator
11 " 🔵 AddTransactionModal and EditTransactionModal Form Structure Confirmed for time Field Integration
12 11:20p 🟣 SQL Migration Created: time Column + effective_time Generated Column + All RPCs Updated
S2 Fix progress bar alignment in portfolio mockup (May 6, 11:31 PM)
S1 Replace fixed type-priority transaction ordering with optional explicit time field (HH:MM) so users can control same-day transaction order, affecting PRU and cash replay calculations (May 6, 11:31 PM)
13 11:37p 🔴 Fix progress bar alignment in portfolio mockup
S3 Fix misaligned progress bars in portfolio mockup on landing page—bars should align with each other, not with adjacent numbers (May 6, 11:38 PM)
### May 7, 2026
14 9:30p 🔵 AccountList and Account Type Architecture Pre-Edit-Feature
15 9:31p 🔵 accounts/[id]/route.ts Only Has DELETE — No PATCH Handler Exists
16 " 🔵 Schema and Validation Architecture for Account Edit Feature
17 9:33p 🔵 DB Trigger Raises 'account_has_positions' on Type Downgrade
18 " 🟣 PATCH /api/accounts/:id Handler + Account Edit Validation Logic
20 9:35p 🟣 AccountList.tsx — EditAccountDialog Component and Edit Flow Added
31 9:41p 🟣 Account Edit Feature: Full-Stack Implementation
34 10:58p 🟣 Account Edit Feature Requested for AccountList.tsx
35 " 🟣 Account Edit Feature Fully Implemented
36 11:10p 🟣 Account Editing Feature Request with Crypto Type Restriction
37 " 🔄 Centralized API Error Message Utility (lib/api-errors.ts)
38 11:12p 🟣 Account Editing Feature Implementation Complete — Full Scope Confirmed
39 11:13p 🔵 Charts.tsx Still Has Hardcoded Blue Colors for Dividend UI Elements
40 11:15p 🔵 Annual Performance Table "Total" Row Dividends Still Uses text-blue-600
41 " 🔴 Annual Performance Table "Total" Row Dividends Color Fixed
42 11:19p 🔄 Transaction Validation Error Messages Made User-Friendly
### May 8, 2026
43 12:00a 🟣 Account Edit Feature with Crypto Type Restriction
44 " 🔵 Lint Passes with One Unused Variable Warning
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

Access 843k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>