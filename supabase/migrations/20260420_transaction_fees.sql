-- Frais attachés à une transaction : pattern "FEE liée".
-- Quand une transaction (BUY, SELL, DEPOSIT, WITHDRAWAL, DIVIDEND, INTEREST) a des frais,
-- une ligne FEE séparée est insérée et référencée via fee_transaction_id.
-- Avantage : la ligne FEE porte son propre impact cash → le calculator reste inchangé.
-- ON DELETE SET NULL : si la FEE est supprimée seule, le lien se casse proprement.
-- Côté app, la suppression de la transaction principale déclenche la suppression de la FEE liée.

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_fees_non_negative;

ALTER TABLE transactions
  DROP COLUMN IF EXISTS fees;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS fee_transaction_id UUID
  REFERENCES transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_fee_transaction_id
  ON transactions(fee_transaction_id);
