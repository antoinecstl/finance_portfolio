-- Jetons d'accès personnels pour l'API publique (/api/v1) et le serveur MCP (/api/mcp).
-- Le jeton en clair n'est jamais stocké : seul son empreinte SHA-256 l'est, et il
-- n'est montré qu'une fois à l'utilisateur à la création.
-- Lecture de ses propres jetons autorisée ; toute écriture passe par les routes
-- serveur (service role) après vérification de la session.
create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  -- Début du jeton (ex. "fih_Ab12Cd"), pour le reconnaître dans l'interface.
  token_prefix text not null check (char_length(token_prefix) between 4 and 16),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null default '{read}',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
);

create index if not exists idx_api_tokens_user on public.api_tokens(user_id, created_at desc);

alter table public.api_tokens enable row level security;

drop policy if exists "Users can view own api tokens" on public.api_tokens;
create policy "Users can view own api tokens" on public.api_tokens
  for select using (auth.uid() = user_id);
