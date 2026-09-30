# Politique de confidentialité — proposition de mise à jour

Statut : **proposition à valider**, préparée le 30/09/2026. Ce document n'est pas une validation juridique. La page en ligne (`app/(marketing)/legal/confidentialite/page.tsx`, datée du 18/04/2026) n'a pas été modifiée.

Méthode : lecture du code du dépôt uniquement.
- Seuls des **noms** de variables d'environnement sont cités, jamais leurs valeurs.
- Ce qui ne peut pas être établi par le code est marqué **[À confirmer]** : configuration de production, contrats, régions, durées de conservation chez les prestataires.
- Rien n'est déduit de la région Supabase pour les autres prestataires.

## 1. Services et intégrations identifiés

### Actifs (appelés dans les parcours standard de l'application)

| Service | Rôle | Données personnelles concernées | Élément de code | Mentionné aujourd'hui |
|---|---|---|---|---|
| Supabase | Base de données, authentification | Email, mot de passe (haché), profil, comptes, transactions, historique des imports | `lib/supabase/*` | Oui (« infrastructure UE ») |
| Vercel | Hébergement de l'application | Requêtes HTTP (dont adresse IP) traitées par l'hébergeur | déploiement (README) | Oui |
| Vercel Analytics et Speed Insights | Mesure d'audience et de performance | Données de navigation collectées par ces scripts **[À confirmer : nature exacte]** | `app/layout.tsx` (`<Analytics />`, `<SpeedInsights />`) | **Non** |
| Paddle | Paiement, facturation, TVA (Merchant of Record) | Données de facturation, email | `lib/paddle.ts`, `BillingActions.tsx` (Paddle.js) | Oui |
| Resend | Emails transactionnels | Email, contenu des messages | `lib/email.ts` (envoi ignoré si `RESEND_API_KEY` est absent) | Oui |

### Actifs sous condition de configuration [À confirmer en production]

| Service | Rôle | Données envoyées | Condition d'activation | Mentionné aujourd'hui |
|---|---|---|---|---|
| Mistral (`api.mistral.ai/v1/ocr`) | Lecture des relevés PDF et des images (import, offre Pro) | **Fichier complet** encodé en base64 | `MISTRAL_API_KEY` (présente dans l'environnement local ; un commit récent traite ses erreurs 429) | **Non** |
| OpenAI (API Chat Completions) | Lecture de secours des PDF et images ; lecture des CSV/Excel non reconnus et du texte collé | Fichier complet (secours) ; en-têtes et **toutes les lignes** du tableau ; texte collé intégral ; nom du fichier ; devise du compte | `OPENAI_API_KEY` (`LLM_PROVIDER` vaut `openai` par défaut, seul fournisseur implémenté) | **Non** |
| Notification d'inscription (Edge Function `new-signup-notification`) | Alerte interne à chaque nouvelle inscription | Email, identifiant, date de création, statut de confirmation de l'email | Hook d'authentification configuré **et**, pour chaque canal, son secret : Slack (`SIGNUP_SLACK_WEBHOOK_URL`), Discord (`SIGNUP_DISCORD_WEBHOOK_URL`), ntfy (topic `SIGNUP_NTFY_*`, serveur `ntfy.sh` par défaut), Telegram (jeton de bot et identifiant de chat) | **Non** |

Seuls les canaux réellement configurés doivent apparaître dans la politique. La présence du code ne prouve pas qu'un canal est actif.

### Sans transmission de données personnelles identifiée

- **Yahoo Finance** (`lib/stock-api.ts`) : requêtes serveur contenant des symboles boursiers, pour les cours. Aucun identifiant utilisateur n'est transmis dans le code. Il s'agit d'une source de données, pas d'un sous-traitant de données personnelles **[À confirmer]**.
- **Google Fonts** : les polices sont intégrées au build par `next/font`, sans requête vers Google au chargement des pages.
- **GitHub Actions** (`keep-db-alive.yml`) : envoie un ping à l'API Supabase avec la clé publique, sans donnée utilisateur.

## 2. Conservation observable dans le code

- **Table `import_jobs`**, pour chaque import :
  - nom du fichier, type, statut, compteurs, empreinte SHA-256, format détecté, avertissements ;
  - un **extrait** du contenu : au plus 2 000 caractères de texte ou de résultat OCR, ou les en-têtes et les 5 premières lignes d'un tableau.
- **Accès et suppression** : ces lignes sont protégées par utilisateur (RLS) et supprimées en cascade avec le compte. **Aucune purge automatique** n'a été trouvée dans le code. La durée effective est donc celle du compte **[À confirmer]**.
- **Fichiers importés** : ils ne sont pas stockés dans Fi-Hub, seul l'extrait ci-dessus est conservé. Ce qu'en conservent Mistral et OpenAI dépend de leurs conditions et de la configuration du compte **[À confirmer]**.
- **Journaux serveur** : les erreurs d'import sont journalisées (`console.error`) dans les logs de l'hébergeur. Leur contenu peut inclure le message d'erreur du prestataire **[À confirmer : durée de conservation des logs Vercel]**.

## 3. Texte proposé (à adapter après confirmation)

**§2 Données collectées** — ajouter :
> Si vous utilisez l'import (offre Pro) : le fichier ou le texte que vous transmettez, et un extrait limité de son contenu conservé avec l'historique de vos imports.

**§5 Destinataires** — remplacer la liste par :
> - Supabase — hébergement de la base de données et authentification [région : à confirmer].
> - Vercel — hébergement de l'application, mesure d'audience et de performance (Vercel Analytics, Speed Insights).
> - Paddle — paiement, facturation et TVA (Merchant of Record).
> - Resend — envoi des emails transactionnels.
> - [Si actif] Mistral AI — lecture des relevés PDF et des images lors d'un import.
> - [Si actif] OpenAI — lecture des relevés tabulaires non reconnus, du texte collé, et secours pour les PDF et images lors d'un import.
> - [Si actif, canal par canal] Outil de notification interne — alerte à l'équipe lors d'une nouvelle inscription (email et date d'inscription).
>
> [À compléter pour chaque prestataire : localisation des traitements et garanties de transfert hors UE le cas échéant.]

**§6 Durée de conservation** — ajouter :
> L'historique des imports (nom du fichier, statut, extrait limité du contenu) est conservé tant que le compte est actif et supprimé avec lui. [À compléter : conservation chez les prestataires d'analyse de documents.]

**§8 Sécurité** — la mention actuelle (« isolation stricte par utilisateur », RLS) est cohérente avec le code. Aucune garantie supplémentaire n'est proposée.

## 4. Points à confirmer avant publication

1. Variables configurées en production (Vercel) : `MISTRAL_API_KEY`, `OPENAI_API_KEY`, `LLM_PROVIDER`.
2. Hook d'authentification et canaux de notification configurés (secrets Supabase `SIGNUP_*`).
3. Région du projet Supabase et régions ou conditions de traitement de Vercel, Mistral, OpenAI et Resend.
4. Conditions de conservation et d'usage des données chez Mistral et OpenAI pour le compte utilisé.
5. Nouvelle date de mise à jour de la politique.
