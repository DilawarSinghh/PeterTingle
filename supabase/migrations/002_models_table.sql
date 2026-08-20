-- Migration 002: Models table + seed data + foreign keys on messages/conversations

-- ─── models table ────────────────────────────────────────────────────────────
create table if not exists public.models (
  id                 text primary key,
  display_name       text not null,
  provider           text not null,   -- 'openai' | 'anthropic' | 'groq' | 'openrouter'
  base_url           text not null,
  is_active          boolean not null default true,
  input_cost_per_1k  numeric,         -- USD per 1k input tokens
  output_cost_per_1k numeric          -- USD per 1k output tokens
);

-- models is read-only for authenticated users (no RLS write needed — admin manages via migrations)
alter table public.models enable row level security;

drop policy if exists "models: anyone authenticated can read" on public.models;
create policy "models: anyone authenticated can read"
  on public.models
  for select
  using (auth.role() = 'authenticated');

-- ─── Seed models ─────────────────────────────────────────────────────────────
insert into public.models (id, display_name, provider, base_url, is_active, input_cost_per_1k, output_cost_per_1k) values
  -- OpenAI (via direct API)
  ('gpt-4o-mini',          'GPT-4o Mini',           'openai',     'https://api.openai.com/v1',          true,  0.000150, 0.000600),
  ('gpt-4o',               'GPT-4o',                'openai',     'https://api.openai.com/v1',          true,  0.002500, 0.010000),
  -- Anthropic
  ('claude-haiku-3-5',     'Claude 3.5 Haiku',      'anthropic',  'https://api.anthropic.com',          true,  0.000800, 0.004000),
  ('claude-sonnet-3-5',    'Claude 3.5 Sonnet',     'anthropic',  'https://api.anthropic.com',          true,  0.003000, 0.015000),
  -- Groq (ultra-fast inference)
  ('llama-3.1-8b-instant', 'Llama 3.1 8B (Groq)',   'groq',       'https://api.groq.com/openai/v1',     true,  0.000050, 0.000080),
  ('llama-3.3-70b-versatile','Llama 3.3 70B (Groq)','groq',       'https://api.groq.com/openai/v1',     true,  0.000590, 0.000790),
  -- OpenRouter (multi-provider gateway)
  ('mistralai/mistral-7b-instruct',   'Mistral 7B',          'openrouter', 'https://openrouter.ai/api/v1', true,  0.000055, 0.000055),
  ('meta-llama/llama-3.1-8b-instruct','Llama 3.1 8B (OR)',   'openrouter', 'https://openrouter.ai/api/v1', true,  0.000055, 0.000055),
  ('tencent/hy3',                     'HunyuanLarge (OR)',   'openrouter', 'https://openrouter.ai/api/v1', true,  0.000126, 0.000522)
on conflict (id) do nothing;

-- ─── Add model_id to messages ─────────────────────────────────────────────────
alter table public.messages
  add column if not exists model_id text references public.models(id);

-- ─── Add default_model_id to conversations ───────────────────────────────────
alter table public.conversations
  add column if not exists default_model_id text references public.models(id) default 'gpt-4o-mini';

-- Index for model usage analytics
create index if not exists messages_model_id_idx on public.messages (model_id);
