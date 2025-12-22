-- Script SQL pour créer les tables Supabase avec Row Level Security (RLS)
-- Exécutez ce script dans l'éditeur SQL de votre projet Supabase

-- ============================================
-- ÉTAPE 1 : Créer les tables avec user_id
-- ============================================

-- Table des comptes (PEA, Livret A, etc.)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('PEA', 'LIVRET_A', 'LDDS', 'CTO', 'ASSURANCE_VIE', 'PEL', 'AUTRE')),
  balance DECIMAL(15, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'EUR',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE')),
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  stock_symbol VARCHAR(20),
  quantity DECIMAL(15, 6),
  price_per_unit DECIMAL(15, 4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des positions actions
CREATE TABLE IF NOT EXISTS stock_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  quantity DECIMAL(15, 6) NOT NULL,
  average_price DECIMAL(15, 4) NOT NULL,
  current_price DECIMAL(15, 4) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'EUR',
  sector VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, account_id, symbol)
);

-- Table historique du portefeuille (OPTIONNEL - peut être calculé dynamiquement)
-- Cette table n'est plus nécessaire car l'historique est calculé à partir des transactions
-- et des cours historiques via Yahoo Finance API
-- Gardée ici pour référence mais peut être supprimée

-- CREATE TABLE IF NOT EXISTS portfolio_history (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
--   date DATE NOT NULL,
--   total_value DECIMAL(15, 2) NOT NULL,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   UNIQUE(user_id, date)
-- );

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_stock_positions_user_id ON stock_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_positions_account_id ON stock_positions(account_id);
CREATE INDEX IF NOT EXISTS idx_stock_positions_symbol ON stock_positions(symbol);
-- CREATE INDEX IF NOT EXISTS idx_portfolio_history_user_id ON portfolio_history(user_id);
-- CREATE INDEX IF NOT EXISTS idx_portfolio_history_date ON portfolio_history(date);

-- Fonction pour mettre à jour le timestamp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour auto-update des timestamps
DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stock_positions_updated_at ON stock_positions;
CREATE TRIGGER update_stock_positions_updated_at
  BEFORE UPDATE ON stock_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ÉTAPE 2 : Activer Row Level Security (RLS)
-- ============================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_positions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE portfolio_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ÉTAPE 3 : Créer les politiques RLS
-- ============================================

-- Politiques pour la table accounts
CREATE POLICY "Users can view own accounts" ON accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts" ON accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" ON accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Politiques pour la table transactions
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Politiques pour la table stock_positions
CREATE POLICY "Users can view own positions" ON stock_positions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own positions" ON stock_positions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own positions" ON stock_positions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own positions" ON stock_positions
  FOR DELETE USING (auth.uid() = user_id);

-- Politiques pour la table portfolio_history (OPTIONNEL - table non utilisée)
-- CREATE POLICY "Users can view own history" ON portfolio_history
--   FOR SELECT USING (auth.uid() = user_id);

-- CREATE POLICY "Users can insert own history" ON portfolio_history
--   FOR INSERT WITH CHECK (auth.uid() = user_id);

-- CREATE POLICY "Users can update own history" ON portfolio_history
--   FOR UPDATE USING (auth.uid() = user_id);

-- CREATE POLICY "Users can delete own history" ON portfolio_history
--   FOR DELETE USING (auth.uid() = user_id);

-- Données de démonstration (optionnel)
INSERT INTO accounts (name, type, balance, currency) VALUES
  ('PEA Boursorama', 'PEA', 15000.00, 'EUR'),
  ('Livret A', 'LIVRET_A', 22950.00, 'EUR'),
  ('LDDS', 'LDDS', 12000.00, 'EUR')
ON CONFLICT DO NOTHING;
