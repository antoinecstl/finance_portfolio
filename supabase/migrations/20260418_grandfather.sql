-- Grandfather the founder account: lifetime Pro access.
-- Matches by email against auth.users; idempotent (safe to re-run).

update public.profiles
set is_founder = true,
    updated_at = now()
where id in (
  select id from auth.users where lower(email) = lower('antoinecstl@gmail.com')
);
