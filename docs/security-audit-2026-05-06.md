# Audit de sécurité — 2026-05-06

## Périmètre audité

- Middleware Next.js et routage applicatif.
- Routes API authentifiées sous `app/api`.
- Configuration des en-têtes HTTP (`next.config.ts`).
- Intégration Supabase SSR / client service-role.
- Webhook Paddle et flux d'import.

## Synthèse exécutive

La plateforme applique déjà plusieurs contrôles importants : authentification Supabase côté serveur, RLS implicite dans les requêtes utilisateur, validation Zod des écritures principales, signature Paddle, idempotence webhook, limitation de débit sur les endpoints coûteux et en-têtes de base (`HSTS`, `nosniff`, `Referrer-Policy`).

L'audit a toutefois identifié deux durcissements prioritaires, appliqués dans cette branche :

1. Protection CSRF / origine pour toutes les mutations authentifiées qui s'appuient sur des cookies de session.
2. Politique CSP globale pour réduire l'impact d'une injection XSS et interdire les objets/plugins embarqués.

## Vulnérabilités et corrections appliquées

### SEC-001 — Mutations authentifiées sans contrôle d'origine

- **Sévérité : élevée**
- **Constat :** plusieurs endpoints `POST`, `PATCH` ou `DELETE` utilisent l'authentification par cookie Supabase et acceptaient les requêtes sans vérifier qu'elles provenaient du même site.
- **Impact :** un site tiers pouvait tenter une action state-changing au nom d'un utilisateur connecté si les cookies étaient envoyés par le navigateur ou si la configuration cookie évoluait.
- **Correction :** ajout d'un garde centralisé `enforceAuthenticatedMutation()` qui compare `Origin`/`Referer` à l'origine attendue, puis déploiement sur les routes mutantes authentifiées. Les webhooks signés restent exclus volontairement.

### SEC-002 — Corps JSON sans garde uniforme de média/taille

- **Sévérité : moyenne**
- **Constat :** des endpoints parsant du JSON ne vérifiaient pas systématiquement `Content-Type` ni `Content-Length` avant `request.json()`.
- **Impact :** surface accrue pour erreurs de parsing, abus de payload et comportements ambigus entre clients.
- **Correction :** ajout de `enforceAuthenticatedJsonMutation()` qui impose `application/json` et une limite par défaut de 1 Mo pour les routes JSON authentifiées.

### SEC-003 — CSP absente

- **Sévérité : moyenne**
- **Constat :** les en-têtes de sécurité existaient, mais aucune `Content-Security-Policy` n'était envoyée.
- **Impact :** une injection XSS aurait moins de contraintes d'exécution et de chargement de ressources.
- **Correction :** ajout d'une CSP globale (`default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'`, `form-action 'self'`, restrictions images/fonts/connect`).

## Points positifs observés

- Les pages protégées sont redirigées vers `/login` via middleware serveur.
- Les redirections post-auth passent par `safeInternalRedirect()` pour éviter les open redirects.
- Les endpoints sensibles revérifient l'utilisateur via `supabase.auth.getUser()`.
- Les routes transactionnelles valident l'appartenance du compte et simulent les séquences avant écriture.
- Les webhooks Paddle valident la signature et utilisent une table d'idempotence.
- Les imports et les endpoints de marché les plus coûteux disposent déjà de rate limits.

## Recommandations restantes

1. Remplacer le rate limiting mémoire par un store partagé (Redis/Upstash) avant déploiement multi-région.
2. Ajouter un CSP nonce-based pour supprimer progressivement `script-src 'unsafe-inline'`.
3. Activer une analyse de dépendances en CI (`npm audit` ou outil SCA) avec accès registre autorisé.
4. Ajouter des tests automatisés pour les refus `forbidden_origin`, `unsupported_media_type` et `payload_too_large`.
5. Surveiller les erreurs `403 forbidden_origin` dans les logs après déploiement pour détecter d'éventuels clients légitimes non conformes.
