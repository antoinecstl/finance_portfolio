-- Durcissement de l'API publique (/api/v1, /api/mcp) et support OAuth.
--
-- 1. Isolation dans Postgres : l'application ne passe plus jamais d'user_id.
--    Elle transmet le jeton reçu ; les fonctions ci-dessous retrouvent le
--    propriétaire à partir de l'empreinte du jeton et ne renvoient que ses lignes.
--    Elles sont réservées au service_role (jamais exposées à anon/authenticated).
-- 2. Limitation de débit partagée entre toutes les instances (table + fonction).
-- 3. Accès réservé aux comptes Pro (public.user_has_pro_access).
-- 4. Tables OAuth 2.1 (clients enregistrés dynamiquement, codes d'autorisation)
--    et colonnes de jeton OAuth (refresh token, client) sur api_tokens.

-- ---------------------------------------------------------------------------
-- Limitation de débit (fenêtre fixe)
-- ---------------------------------------------------------------------------
create table if not exists public.api_rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

alter table public.api_rate_limits enable row level security;
-- Aucune policy : accès uniquement via les fonctions security definer.

create or replace function public.api_rate_limit_hit(
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.api_rate_limits as rl (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = rl.hits + 1
  returning rl.hits into v_hits;

  -- Purge opportuniste des fenêtres expirées.
  if random() < 0.01 then
    delete from public.api_rate_limits where window_start < now() - interval '1 day';
  end if;

  return query select
    v_hits <= p_max,
    case
      when v_hits <= p_max then 0
      else greatest(1, ceil(extract(epoch from (v_window + make_interval(secs => p_window_seconds) - now())))::integer)
    end;
end;
$$;

-- ---------------------------------------------------------------------------
-- OAuth 2.1
-- ---------------------------------------------------------------------------
create table if not exists public.oauth_clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null check (char_length(client_name) between 1 and 100),
  redirect_uris text[] not null check (cardinality(redirect_uris) between 1 and 10),
  -- null = client public (PKCE seul), cas des connecteurs Claude / ChatGPT.
  client_secret_hash text check (client_secret_hash is null or client_secret_hash ~ '^[0-9a-f]{64}$'),
  token_endpoint_auth_method text not null default 'none'
    check (token_endpoint_auth_method in ('none', 'client_secret_post', 'client_secret_basic')),
  created_at timestamptz not null default now()
);

create table if not exists public.oauth_authorization_codes (
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  client_id uuid not null references public.oauth_clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  scopes text[] not null default '{read}',
  resource text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_oauth_codes_expires on public.oauth_authorization_codes(expires_at);

alter table public.oauth_clients enable row level security;
alter table public.oauth_authorization_codes enable row level security;
-- Aucune policy : gérées uniquement côté serveur (service role).

alter table public.api_tokens
  add column if not exists kind text not null default 'personal' check (kind in ('personal', 'oauth')),
  add column if not exists client_id uuid references public.oauth_clients(id) on delete cascade,
  add column if not exists refresh_token_hash text unique check (refresh_token_hash is null or refresh_token_hash ~ '^[0-9a-f]{64}$'),
  add column if not exists refresh_expires_at timestamptz;

-- ---------------------------------------------------------------------------
-- Résolution du jeton → propriétaire
-- ---------------------------------------------------------------------------
create or replace function public.api_token_hash(p_token text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

-- Propriétaire d'un jeton valide (non révoqué, non expiré, compte Pro), sinon null.
create or replace function public.api_token_owner(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.user_id
  from public.api_tokens t
  where t.token_hash = public.api_token_hash(p_token)
    and t.revoked_at is null
    and (t.expires_at is null or t.expires_at > now())
    and public.user_has_pro_access(t.user_id);
$$;

-- Authentifie une requête : validité du jeton, offre Pro, limite de débit,
-- horodatage d'usage. Un seul appel par requête HTTP.
create or replace function public.api_authenticate(
  p_token text,
  p_rate_limit integer default 60,
  p_rate_window_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.api_tokens%rowtype;
  v_allowed boolean;
  v_retry integer;
begin
  select * into v_token from public.api_tokens where token_hash = public.api_token_hash(p_token);

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_token.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;
  if v_token.expires_at is not null and v_token.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if not public.user_has_pro_access(v_token.user_id) then
    return jsonb_build_object('status', 'plan_required');
  end if;

  select rl.allowed, rl.retry_after into v_allowed, v_retry
  from public.api_rate_limit_hit('api-token:' || v_token.id::text, p_rate_limit, p_rate_window_seconds) rl;
  if not v_allowed then
    return jsonb_build_object('status', 'rate_limited', 'retry_after', v_retry);
  end if;

  if v_token.last_used_at is null or v_token.last_used_at < now() - interval '5 minutes' then
    update public.api_tokens set last_used_at = now() where id = v_token.id;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'token_id', v_token.id,
    'scopes', to_jsonb(v_token.scopes)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Lecture des données du propriétaire du jeton
-- ---------------------------------------------------------------------------
create or replace function public.api_accounts(p_token text)
returns setof public.accounts
language sql
stable
security definer
set search_path = public
as $$
  select a.*
  from public.accounts a
  where a.user_id = public.api_token_owner(p_token)
  order by a.created_at;
$$;

create or replace function public.api_transactions(
  p_token text,
  p_account_id uuid default null,
  p_type text default null,
  p_symbol text default null,
  p_from date default null,
  p_to date default null,
  p_cursor_date date default null,
  p_cursor_time time default null,
  p_cursor_id uuid default null,
  p_limit integer default null
)
returns setof public.transactions
language sql
stable
security definer
set search_path = public
as $$
  select t.*
  from public.transactions t
  where t.user_id = public.api_token_owner(p_token)
    and (p_account_id is null or t.account_id = p_account_id)
    and (p_type is null or t.type = p_type)
    and (p_symbol is null or upper(t.stock_symbol) = upper(p_symbol))
    and (p_from is null or t.date >= p_from)
    and (p_to is null or t.date <= p_to)
    and (
      p_cursor_date is null
      or (t.date, t.effective_time, t.id) < (p_cursor_date, p_cursor_time, p_cursor_id)
    )
  order by t.date desc, t.effective_time desc, t.id desc
  limit p_limit;
$$;

create or replace function public.api_profile(p_token text)
returns table (email text, is_pro boolean)
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.email::text, public.user_has_pro_access(u.id)
  from auth.users u
  where u.id = public.api_token_owner(p_token);
$$;

-- ---------------------------------------------------------------------------
-- Droits : service_role uniquement
-- ---------------------------------------------------------------------------
revoke all on function public.api_rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.api_token_owner(text) from public, anon, authenticated;
revoke all on function public.api_authenticate(text, integer, integer) from public, anon, authenticated;
revoke all on function public.api_accounts(text) from public, anon, authenticated;
revoke all on function public.api_transactions(text, uuid, text, text, date, date, date, time, uuid, integer) from public, anon, authenticated;
revoke all on function public.api_profile(text) from public, anon, authenticated;

grant execute on function public.api_rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.api_token_owner(text) to service_role;
grant execute on function public.api_authenticate(text, integer, integer) to service_role;
grant execute on function public.api_accounts(text) to service_role;
grant execute on function public.api_transactions(text, uuid, text, text, date, date, date, time, uuid, integer) to service_role;
grant execute on function public.api_profile(text) to service_role;
