# Import de transactions

Module responsable de l'extraction de transactions financières depuis des
fichiers utilisateur (CSV, XLSX, PDF) ou du texte collé, avec preview avant
écriture en base.

## Vue d'ensemble

L'import fonctionne en **deux étapes** distinctes pour ne jamais polluer la
table `transactions` avec des données mal extraites :

1. **`POST /api/import/parse`** — analyse l'upload, normalise les transactions,
   stocke un `import_jobs` avec `status='previewing'`. Aucune ligne dans
   `transactions`.
2. **`POST /api/import/commit`** — re-valide chaque ligne (potentiellement
   éditée par l'utilisateur), vérifie quotas et tickers, insère le lot
   atomiquement via le RPC `insert_transactions_batch`, marque le job
   `committed`.

```
Client                  /api/import/parse              Orchestrator           Provider
┌──────┐  upload  ┌────────────────────────┐  route  ┌─────────────┐ extract ┌─────────┐
│ form │─────────▶│ auth + Pro + rate limit│────────▶│ sourceType? │────────▶│ OCR/LLM │
└──────┘          │ + idempotency check    │         └─────────────┘         └─────────┘
                  └────────────────────────┘                │                      │
                                                            ▼                      ▼
                                                  ┌──────────────────┐    ParseResult
                                                  │ import_jobs      │    (transactions,
                                                  │ status=previewing│     notes, format)
                                                  └──────────────────┘
                                                            │
                                  preview + édition manuelle│
                                                            ▼
Client                  /api/import/commit
┌──────┐  validate ┌─────────────────────────────┐
│ form │──────────▶│ Zod strict + quota + tickers│──▶ insert_transactions_batch (RPC)
└──────┘           │ → import_jobs.status=       │     atomique, re-vérifie quotas
                   │   committed | failed        │
                   └─────────────────────────────┘
```

## Sources et pipelines

L'orchestrateur ([orchestrator.ts](orchestrator.ts)) route chaque source vers
le pipeline le plus adapté :

| Source       | Pipeline                                          | Coût    |
| ------------ | ------------------------------------------------- | ------- |
| **PDF**      | Mistral OCR (extraction structurée en 1 appel)    | $$      |
| **CSV/XLSX** | Parseurs déclaratifs → fallback LLM si non reconnu | 0 ou $  |
| **Texte**    | LLM directement                                   | $       |

### PDF → Mistral OCR

Les PDF (souvent des scans de relevés bancaires) sont envoyés à
[`/v1/ocr`](ocr.ts) avec un `document_annotation_format` qui combine OCR et
extraction structurée en **un seul appel**. Pas de pipeline `pdfjs → LLM` :
- Le schéma JSON strict ([ocr.ts:28](ocr.ts#L28)) impose la forme de sortie.
- Toute la guidance d'extraction (mapping FR → types, conversion ISIN →
  ticker Yahoo, format de date) tient dans les `description` des champs car
  Mistral OCR n'a pas de "system prompt" séparé.
- La sortie est validée par Zod ([ocr.ts:112](ocr.ts#L112)) — si le schéma
  diverge, on remonte une erreur typée plutôt que d'invent des données.

### CSV/XLSX → cascade déclaratif puis LLM

1. **Parsing local** ([parsers.ts](parsers.ts)) : PapaParse (auto-détection
   du séparateur) ou ExcelJS (gestion des dates Excel et formules). Sortie :
   `TabularContent { headers, rows }`.
2. **Parseurs déclaratifs** ([declarative.ts](declarative.ts)) : signatures
   par broker (Boursorama, Trade Republic). Si les en-têtes matchent, on
   parse en local — **zéro coût LLM, déterministe**.
3. **Fallback LLM** ([llm.ts](llm.ts)) : si aucun parseur déclaratif ne
   reconnaît le format, on envoie headers + rows à OpenAI avec Structured
   Outputs strict.

### Texte collé → LLM

Pas de parsing local possible. Envoyé directement au LLM avec le système de
Structured Outputs.

## Idempotence

Chaque import calcule une `idempotency_key = SHA256(account_id + sourceType +
content)` ([orchestrator.ts:83](orchestrator.ts#L83)). La table `import_jobs`
a un index unique `(user_id, idempotency_key)` :

- Si un job avec la même clé existe en `status='committed'` → **409 Conflict**.
  Le fichier a déjà été importé, on refuse.
- Si le job existe en `previewing | failed | cancelled` → on le **remplace**
  (les lignes ne sont pas en base, donc on peut re-parser sans risque de
  doublon).

## Sécurité et garde-fous

| Garde-fou               | Implémentation                                       |
| ----------------------- | ---------------------------------------------------- |
| Auth                    | `supabase.auth.getUser()` sur les deux routes        |
| Pro requis              | `hasUserFeature('import_transactions')` → 402 sinon  |
| Rate limit              | 10 imports/heure/user (déclenche un appel LLM payant) |
| Taille fichier          | 10 MB max (multipart) / 200 000 chars max (texte)    |
| Format autorisé         | Détection par extension + content-type → 415 sinon   |
| Appartenance compte     | Vérif `account.user_id === user.id` avant LLM        |
| Validation des lignes   | Zod strict côté `/commit` (`createTransactionSchema`) |
| Quotas plan             | Pré-check côté API + re-vérif atomique côté RPC      |
| Tickers inconnus        | `getStockQuotes` Yahoo → 422 si symbole non reconnu  |
| Compatibilité compte    | Asset/account match (PEA ↔ actions UE, etc.)         |

## Configuration

Variables d'environnement (toutes optionnelles sauf les clés API) :

| Variable           | Défaut                | Rôle                                     |
| ------------------ | --------------------- | ---------------------------------------- |
| `LLM_PROVIDER`     | `openai`              | Provider LLM pour CSV/XLSX/texte         |
| `LLM_MODEL`        | `gpt-5.4-nano`        | Modèle OpenAI utilisé en fallback        |
| `OPENAI_API_KEY`   | —                     | **Requis** pour LLM_PROVIDER=openai      |
| `OCR_PROVIDER`     | `mistral`             | Provider OCR pour les PDF                |
| `OCR_MODEL`        | `mistral-ocr-latest`  | Modèle Mistral OCR                       |
| `MISTRAL_API_KEY`  | —                     | **Requis** pour OCR_PROVIDER=mistral     |

## Étendre

### Ajouter un broker (parseur déclaratif)

Un nouveau broker = pas d'appel LLM si le format est constant. Ajouter dans
[`declarative.ts`](declarative.ts) :

```ts
const monBroker: DeclarativeParser = {
  id: 'mon-broker',
  label: 'Mon Broker',
  matches: (headers) => hasAll(headers, ['date', 'libelle', 'isin']),
  parse: (content) => { /* renvoie { transactions, notes } */ },
};
// Puis l'ajouter à PARSERS = [boursorama, tradeRepublic, monBroker]
```

Si `matches()` retourne `true` mais que `parse()` ne sort aucune
transaction, on passe automatiquement au LLM (signature qui matche par
accident).

### Brancher un autre LLM

Implémenter `LLMProvider` ([llm.ts:16](llm.ts#L16)) puis le brancher dans
`getLLMProvider()` selon la valeur de `LLM_PROVIDER`. Aucun autre fichier
n'a besoin de changer — le reste du code consomme l'interface.

Idem pour OCR : implémenter `OCRProvider` ([ocr.ts:17](ocr.ts#L17)).

## Codes d'erreur

### `/api/import/parse`

| Status | `error`                | Quand                                     |
| ------ | ---------------------- | ----------------------------------------- |
| 400    | `invalid_payload`      | Body mal formé                            |
| 400    | `account_id_missing`   | Pas d'`account_id`                        |
| 400    | `text_missing`         | JSON sans `text`                          |
| 401    | `unauthorized`         | Pas de session                            |
| 402    | `pro_required`         | Compte non Pro                            |
| 403    | `invalid_account`      | Le compte n'appartient pas à l'utilisateur |
| 409    | `already_committed`    | Idempotency hit sur job déjà committé     |
| 413    | `file_too_large`       | > 10 MB                                   |
| 413    | `text_too_long`        | > 200 000 chars                           |
| 415    | `unsupported_format`   | Extension/MIME non reconnu                |
| 429    | `rate_limited`         | > 10 imports / heure                      |
| 500    | `internal_error`       | Persist `import_jobs` échoué              |
| 502    | `extraction_failed`    | Pipeline OCR/LLM en erreur                |

### `/api/import/commit`

| Status | `error`                              | Quand                                           |
| ------ | ------------------------------------ | ----------------------------------------------- |
| 400    | `invalid_rows`                       | Une ligne échoue la re-validation Zod           |
| 400    | `account_mismatch`                   | account_id ≠ celui du job                       |
| 400    | `asset_account_mismatch`             | Ticker incompatible (ex: action US sur PEA)     |
| 401    | `unauthorized`                       | Pas de session                                  |
| 402    | `pro_required` / `limit_reached`     | Pro requis ou quota free-tier dépassé           |
| 403    | `invalid_account` /                  |                                                 |
|        | `account_does_not_support_positions` |                                                 |
| 404    | `job_not_found`                      | Job inexistant ou pas à l'utilisateur           |
| 409    | `job_already_committed`              | Status ≠ previewing                             |
| 422    | `unknown_symbols`                    | Ticker non reconnu par Yahoo                    |
| 500    | `internal_error`                     | RPC en erreur (job marqué `failed`)             |

## Fichiers

| Fichier                                        | Rôle                                          |
| ---------------------------------------------- | --------------------------------------------- |
| [`types.ts`](types.ts)                         | Schémas Zod + types partagés                  |
| [`parsers.ts`](parsers.ts)                     | CSV (Papa) / XLSX (ExcelJS) / texte           |
| [`declarative.ts`](declarative.ts)             | Parseurs broker (zéro LLM)                    |
| [`llm.ts`](llm.ts)                             | Provider LLM (OpenAI Structured Outputs)      |
| [`ocr.ts`](ocr.ts)                             | Provider OCR (Mistral document_annotation)    |
| [`orchestrator.ts`](orchestrator.ts)           | Routing + idempotency key                     |
| [`../../app/api/import/parse/route.ts`](../../app/api/import/parse/route.ts)   | Route /parse  |
| [`../../app/api/import/commit/route.ts`](../../app/api/import/commit/route.ts) | Route /commit |
