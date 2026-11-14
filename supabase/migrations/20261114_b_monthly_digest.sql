-- Récapitulatif mensuel par e-mail (lib/monthly-digest.ts).
--
-- monthly_digest          : l'utilisateur reçoit le récapitulatif (actif par
--                           défaut, désactivable depuis l'e-mail ou le profil).
-- monthly_digest_sent_for : premier jour du dernier mois récapitulé ; garantit
--                           un seul envoi par mois même si la tâche tourne
--                           chaque jour. Écrit par le serveur uniquement.

alter table public.profiles
  add column if not exists monthly_digest boolean not null default true,
  add column if not exists monthly_digest_sent_for date;

-- Le navigateur peut modifier son profil (RLS) : il ne doit pas pouvoir
-- réécrire le suivi des envois, seulement activer ou couper l'e-mail.
create or replace function public.protect_digest_tracking()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and new.monthly_digest_sent_for is distinct from old.monthly_digest_sent_for then
    new.monthly_digest_sent_for := old.monthly_digest_sent_for;
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_digest_tracking() from public, anon, authenticated;

drop trigger if exists protect_digest_tracking_trigger on public.profiles;
create trigger protect_digest_tracking_trigger
  before update on public.profiles
  for each row execute function public.protect_digest_tracking();
