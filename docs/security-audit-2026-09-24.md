# Audit de sécurité — 24 septembre 2026

## Périmètre et méthode

Revue statique des routes Next.js, de l'authentification Supabase, des politiques
RLS et fonctions SQL, du webhook Paddle, des imports et exports, des en-têtes
HTTP et de la gestion des secrets. Les tests, le lint, le build et l'audit de
dépendances font partie des contrôles de validation.

## Correctifs livrés

| Sévérité | Constat | Correction |
| --- | --- | --- |
| Haute | L'accès administrateur avait une adresse e-mail par défaut lorsque `ADMIN_EMAILS` était absent. Une mauvaise configuration pouvait donc accorder un accès service-role. | Configuration désormais fermée par défaut : aucun administrateur sans liste explicite. |
| Haute | La policy `UPDATE` des comptes n'avait pas de `WITH CHECK`. | Nouvelle migration empêchant tout changement de propriétaire après mise à jour. |
| Moyenne | Le webhook acceptait un JSON non typé et sans limite applicative, et la validation temporelle de signature acceptait syntaxiquement `NaN`. | Taille plafonnée à 256 Kio, schéma Zod strict sur les champs utilisés, timestamp et HMAC validés avant comparaison constante. |
| Moyenne | Les exports financiers ne demandaient pas explicitement aux caches de ne pas les conserver. | Ajout de `Cache-Control: private, no-store` et `nosniff` aux exports JSON/PDF. |
| Faible | Plusieurs erreurs renvoyaient au client des messages internes de fournisseurs ou la configuration serveur attendue. | Réponses publiques génériques, détails conservés uniquement dans les journaux serveur. |
| Faible | Deux en-têtes de cloisonnement navigateur manquaient. | Ajout de COOP et de l'interdiction des cross-domain policies. |

## Contrôles satisfaisants observés

- Toutes les routes de données examinées récupèrent l'utilisateur avec
  `auth.getUser()` et filtrent les lignes avec son identifiant.
- Les mutations authentifiées appliquent un contrôle same-origin; les mutations
  JSON imposent aussi le type de contenu et une limite annoncée.
- Les politiques RLS isolent comptes, transactions, profils, abonnements,
  imports et journaux d'audit; les RPC financières vérifient l'appelant.
- Le webhook Paddle vérifie le corps brut par HMAC, utilise une fenêtre
  anti-rejeu et déduplique les identifiants d'événement.
- Les redirections d'authentification sont limitées aux chemins internes.
- Les secrets serveur ne sont pas préfixés par `NEXT_PUBLIC_` et les fichiers
  `.env*` sont ignorés par Git.

## Risques résiduels et recommandations

1. **Rate limiting distribué (moyen).** Le limiteur en mémoire est local à une
   instance et se réinitialise lors des cold starts. Migrer vers Redis/Upstash ou
   la protection de bord de l'hébergeur avant une montée en charge.
2. **CSP (moyen).** `script-src` contient encore `unsafe-inline` et
   `connect-src`/`img-src` autorisent largement HTTPS. Déployer une CSP avec
   nonce par requête, puis restreindre explicitement Supabase, Paddle et Vercel.
3. **Upload multipart (moyen).** La taille du fichier est contrôlée après le
   parsing du formulaire. Ajouter une limite de corps au reverse proxy/edge afin
   de bloquer les gros flux avant allocation mémoire.
4. **Administration (faible).** Remplacer à terme l'allow-list e-mail par un
   claim serveur (`app_metadata.role`) avec MFA obligatoire et journaliser les
   changements de statut fondateur.
5. **Dépendances (continu).** Activer Dependabot/Renovate et une analyse SCA en
   CI. L'audit npm doit être rejoué depuis un environnement autorisé à joindre
   l'endpoint advisories du registre.

## Exploitation et déploiement

- Définir `ADMIN_EMAILS` en production (liste séparée par des virgules).
- Appliquer la migration `20260924_harden_account_rls.sql` avant ou avec le
  déploiement applicatif.
- Conserver `PADDLE_WEBHOOK_SECRET` et `SUPABASE_SERVICE_ROLE_KEY` uniquement
  dans le coffre de secrets de l'hébergeur et organiser leur rotation.
