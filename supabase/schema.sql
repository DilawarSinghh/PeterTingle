-- TokenSaver — Supabase base schema
-- Safe to re-run: uses IF NOT EXISTS for tables/indexes, DROP before CREATE for policies/triggers.
-- Run FIRST, then run migrations 001–005 in order.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id                uuid references auth.users on delete cascade primary key,
  display_name      text,
  compression_level text not null default 'full'
    check (compression_level in ('lite', 'full', 'ultra')),
  created_at        timestamptz not null default now()
);

create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users on delete cascade not null,
  title      text,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id                 uuid primary key default gen_random_uuid(),
  conversation_id    uuid references public.conversations on delete cascade not null,
  role               text not null check (role in ('user', 'assistant')),
  original_content   text,
  compressed_content text,
  raw_tokens         integer,
  compressed_tokens  integer,
  created_at         timestamptz not null default now()
);

create table if not exists public.usage_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users on delete cascade not null,
  conversation_id uuid references public.conversations on delete set null,
  tokens_saved    integer,
  cost_saved_usd  numeric(12, 8),
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists conversations_user_id_idx    on public.conversations (user_id);
create index if not exists messages_conversation_id_idx on public.messages (conversation_id);
create index if not exists usage_logs_user_id_idx       on public.usage_logs (user_id);
create index if not exists usage_logs_created_at_idx    on public.usage_logs (created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles       enable row level security;
alter table public.conversations  enable row level security;
alter table public.messages       enable row level security;
alter table public.usage_logs     enable row level security;

-- Drop policies before (re)creating — Postgres has no CREATE POLICY IF NOT EXISTS
drop policy if exists "profiles: owner access"       on public.profiles;
drop policy if exists "conversations: owner access"  on public.conversations;
drop policy if exists "messages: owner access"       on public.messages;
drop policy if exists "usage_logs: owner access"     on public.usage_logs;

-- profiles: users own their row
create policy "profiles: owner access"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- conversations: users own their rows
create policy "conversations: owner access"
  on public.conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- messages: accessible via conversation ownership
create policy "messages: owner access"
  on public.messages for all
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

-- usage_logs: users own their rows
create policy "usage_logs: owner access"
  on public.usage_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-create profile on new user signup (trigger)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, compression_level)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    'full'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
