-- Date d'ouverture réelle d'un compte, déclarée par l'utilisateur.
-- Sert au suivi du PEA : l'antériorité fiscale de 5 ans se compte depuis
-- l'ouverture du plan, pas depuis son ajout dans Fi-Hub (created_at).
-- Colonne facultative ; les politiques RLS existantes d'accounts s'y appliquent.

alter table public.accounts
  add column if not exists opened_on date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'accounts_opened_on_plausible') then
    alter table public.accounts
      add constraint accounts_opened_on_plausible
      check (opened_on is null or opened_on >= date '1970-01-01');
  end if;
end;
$$;
