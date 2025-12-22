# 💼 Mon Portefeuille - Suivi Financier

Application web de suivi de portefeuille financier personnel avec :
- 📊 **Dashboard** avec vue d'ensemble de vos finances
- 💰 **Gestion des comptes** (PEA, Livret A, LDDS, CTO, etc.)
- 📈 **Suivi des actions** en temps réel via Yahoo Finance
- 📉 **Graphiques de répartition** (par action et par secteur)
- 📝 **Historique des transactions**

## 🚀 Technologies

- **Next.js 16** - Framework React
- **TypeScript** - Typage statique
- **Tailwind CSS 4** - Styles
- **Supabase** - Base de données PostgreSQL
- **Recharts** - Graphiques
- **Yahoo Finance API** - Cours boursiers en temps réel

## 📦 Installation

```bash
npm install
```

## ⚙️ Configuration

### 1. Créer un projet Supabase

1. Allez sur [supabase.com](https://supabase.com) et créez un compte
2. Créez un nouveau projet
3. Récupérez votre URL et clé anonyme dans **Settings > API**

### 2. Configurer les variables d'environnement

Créez un fichier `.env.local` à la racine :

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-anonyme
```

### 3. Créer les tables dans Supabase

Allez dans l'**éditeur SQL** de Supabase et exécutez le contenu du fichier `supabase/schema.sql`

## 🏃 Lancement

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000)

## 📁 Structure du projet

```
finance_portfolio/
├── app/
│   ├── api/stocks/        # API routes pour les cours boursiers
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Dashboard.tsx      # Composant principal
│   ├── PortfolioStats.tsx # Statistiques du portefeuille
│   ├── AccountList.tsx    # Liste des comptes
│   ├── PositionsTable.tsx # Tableau des positions
│   ├── TransactionsList.tsx
│   ├── Charts.tsx         # Graphiques
│   ├── AddAccountModal.tsx
│   ├── AddTransactionModal.tsx
│   └── AddPositionModal.tsx
├── lib/
│   ├── types.ts          # Types TypeScript
│   ├── supabase.ts       # Client Supabase
│   ├── stock-api.ts      # API Yahoo Finance
│   ├── hooks.ts          # Hooks React
│   └── utils.ts          # Utilitaires
└── supabase/
    └── schema.sql        # Schéma de base de données
```

## 🔧 Fonctionnalités

### Comptes supportés
- PEA (Plan d'Épargne en Actions)
- Livret A
- LDDS (Livret de Développement Durable)
- CTO (Compte-Titres Ordinaire)
- Assurance Vie
- PEL
- Autre

### Types de transactions
- Dépôt / Retrait
- Achat / Vente d'actions
- Dividendes
- Intérêts
- Frais

### Cours boursiers
Les cours sont récupérés via Yahoo Finance. Pour les actions françaises, utilisez le suffixe `.PA` :
- `MC.PA` - LVMH
- `OR.PA` - L'Oréal
- `TTE.PA` - TotalEnergies
- `AIR.PA` - Airbus

## 📱 Captures d'écran

L'application propose :
- Un dashboard avec les statistiques principales
- Des graphiques en camembert pour la répartition
- Un tableau détaillé des positions avec P&L
- Un historique des transactions

## 🤝 Contribution

Les contributions sont les bienvenues !

## 📄 Licence

MIT
