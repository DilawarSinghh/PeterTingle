-- Migration 004: Add tokens_saved + compression_level to messages for dashboard analytics

alter table public.messages
  add column if not exists tokens_saved      integer default 0,
  add column if not exists compression_level text check (compression_level in ('lite', 'full', 'ultra', 'none')),
  add column if not exists key_source        text check (key_source in ('platform', 'user'));

-- Index for dashboard compression level breakdown
create index if not exists messages_compression_level_idx
  on public.messages (conversation_id, compression_level);
