-- Migration 007: Seed OpenAI + Anthropic models (BYOK support)
-- These providers have no dynamic sync (only Groq/NVIDIA do), so their
-- models are seeded statically. Without them, users who save an OpenAI or
-- Anthropic key in Settings see an empty "Your API keys" group in the model
-- selector — because there are no models for those providers to list.
-- IDs use the providers' current canonical model names so real API calls work.

insert into public.models (id, display_name, provider, base_url, is_active, input_cost_per_1k, output_cost_per_1k) values
  -- OpenAI
  ('gpt-4o-mini',              'GPT-4o Mini',      'openai',    'https://api.openai.com/v1',  true, 0.00015, 0.0006),
  ('gpt-4o',                   'GPT-4o',           'openai',    'https://api.openai.com/v1',  true, 0.0025,  0.01),
  ('gpt-4.1-mini',             'GPT-4.1 Mini',     'openai',    'https://api.openai.com/v1',  true, 0.0004,  0.0016),
  ('gpt-4.1',                  'GPT-4.1',          'openai',    'https://api.openai.com/v1',  true, 0.002,   0.008),
  ('o4-mini',                  'o4 Mini',          'openai',    'https://api.openai.com/v1',  true, 0.0011,  0.0044),
  -- Anthropic
  ('claude-3-5-haiku-20241022',   'Claude 3.5 Haiku', 'anthropic', 'https://api.anthropic.com', true, 0.0008, 0.004),
  ('claude-3-7-sonnet-20250219',  'Claude 3.7 Sonnet','anthropic', 'https://api.anthropic.com', true, 0.003,  0.015),
  ('claude-sonnet-4-20250514',    'Claude Sonnet 4',  'anthropic', 'https://api.anthropic.com', true, 0.003,  0.015)
on conflict (id) do update set
  display_name = excluded.display_name,
  provider = excluded.provider,
  base_url = excluded.base_url,
  is_active = true,
  input_cost_per_1k = excluded.input_cost_per_1k,
  output_cost_per_1k = excluded.output_cost_per_1k;
