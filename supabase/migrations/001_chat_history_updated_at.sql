-- Migration 001: Add updated_at to conversations + trigger to keep it current
-- Run in: Supabase Dashboard → SQL Editor

alter table public.conversations
  add column if not exists updated_at timestamptz not null default now();

-- Backfill updated_at from created_at for existing rows
update public.conversations set updated_at = created_at where updated_at is null;

-- Index for efficient ordering by updated_at
create index if not exists conversations_updated_at_idx
  on public.conversations (user_id, updated_at desc);

-- Function: bump conversations.updated_at when a message is inserted
create or replace function public.touch_conversation_updated_at()
returns trigger as $$
begin
  update public.conversations
  set updated_at = now()
  where id = NEW.conversation_id;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_message_inserted on public.messages;
create trigger on_message_inserted
  after insert on public.messages
  for each row execute function public.touch_conversation_updated_at();
