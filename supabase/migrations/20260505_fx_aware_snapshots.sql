-- Snapshots du portefeuille calculés avant FX-aware multi-currency.
--
-- Avant cette migration : calculatePortfolioHistory() sommait tous les buckets
-- cash de manière simple-additive (1 USDC ≡ 1 EUR), et la valeur des positions
-- libellées en USD était ajoutée directement sans conversion. Les snapshots
-- déjà cachés portent ces valeurs faussées.
--
-- À partir de cette migration : on convertit chaque bucket et chaque position
-- en EUR au taux de marché du jour. On vide donc les snapshots existants pour
-- forcer un recompute au prochain accès — le trigger habituel n'est pas
-- déclenché ici puisque les transactions n'ont pas changé.

truncate table public.portfolio_snapshots;
