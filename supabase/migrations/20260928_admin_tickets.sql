-- Backlog prive du dashboard administrateur.
-- Aucune policy : seuls les appels service-role, apres verification admin cote serveur,
-- peuvent lire ou modifier ces tickets.
create table if not exists public.admin_tickets (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 10000),
  acceptance_criteria text not null default '' check (char_length(acceptance_criteria) <= 10000),
  tags text[] not null default '{}',
  status text not null default 'idea' check (status in ('idea', 'planned', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_tickets_status on public.admin_tickets(status);
create index if not exists idx_admin_tickets_updated_at on public.admin_tickets(updated_at desc);

alter table public.admin_tickets enable row level security;

drop trigger if exists update_admin_tickets_updated_at on public.admin_tickets;
create trigger update_admin_tickets_updated_at
  before update on public.admin_tickets
  for each row execute function public.update_updated_at_column();
