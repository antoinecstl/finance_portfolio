-- Migration: Ajout de user_id et RLS sur les tables existantes
-- À exécuter dans Supabase SQL Editor
-- IMPORTANT: Remplacez 'VOTRE_USER_ID' par votre vrai user_id après avoir créé votre compte

-- ============================================
-- ÉTAPE 1: Créez d'abord un compte utilisateur
-- ============================================
-- Allez sur votre app (http://localhost:3000/login)
-- Créez un compte avec votre email
-- Puis récupérez votre user_id avec cette requête:
-- SELECT id, email FROM auth.users;

-- ============================================
-- ÉTAPE 2: Ajout des colonnes user_id
-- ============================================

-- Ajouter user_id aux tables (si pas déjà présent)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE stock_positions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
-- NOTE: portfolio_history n'est plus utilisé (historique calculé dynamiquement)

-- ============================================
-- ÉTAPE 3: Associer vos données existantes à votre utilisateur
-- ============================================
-- REMPLACEZ 'VOTRE_USER_ID' par l'UUID récupéré à l'étape 1
-- Exemple: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

-- Décommentez et exécutez ces lignes après avoir remplacé VOTRE_USER_ID:
-- UPDATE accounts SET user_id = 'VOTRE_USER_ID' WHERE user_id IS NULL;
-- UPDATE stock_positions SET user_id = 'VOTRE_USER_ID' WHERE user_id IS NULL;
-- UPDATE transactions SET user_id = 'VOTRE_USER_ID' WHERE user_id IS NULL;

-- ============================================
-- ÉTAPE 4: Rendre user_id obligatoire (après migration des données)
-- ============================================
-- Exécutez ces lignes UNIQUEMENT après avoir mis à jour toutes les données:
-- ALTER TABLE accounts ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE stock_positions ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE transactions ALTER COLUMN user_id SET NOT NULL;

-- ============================================
-- ÉTAPE 5: Activer RLS et créer les politiques
-- ============================================

-- Activer RLS sur toutes les tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- NOTE: portfolio_history n'est plus utilisé

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can view own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON accounts;

DROP POLICY IF EXISTS "Users can view own positions" ON stock_positions;
DROP POLICY IF EXISTS "Users can insert own positions" ON stock_positions;
DROP POLICY IF EXISTS "Users can update own positions" ON stock_positions;
DROP POLICY IF EXISTS "Users can delete own positions" ON stock_positions;

DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;

-- NOTE: portfolio_history n'est plus utilisé (historique calculé via transactions + Yahoo Finance)

-- Politiques pour accounts
CREATE POLICY "Users can view own accounts" ON accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON accounts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Politiques pour stock_positions
CREATE POLICY "Users can view own positions" ON stock_positions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own positions" ON stock_positions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own positions" ON stock_positions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own positions" ON stock_positions
  FOR DELETE USING (auth.uid() = user_id);

-- Politiques pour transactions
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- VÉRIFICATION
-- ============================================
-- Vérifiez que tout est en place:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- ============================================
-- OPTIONNEL: Supprimer la table portfolio_history si elle existe
-- ============================================
-- DROP TABLE IF EXISTS portfolio_history;
