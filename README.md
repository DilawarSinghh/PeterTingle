# ⛏ TokenSaver

AI chat with built-in compression. Strip filler from your prompts, get terse
technical replies — save tokens on both ends of every conversation.

> Token counts are **inferred** (offline BPE estimates). Not provider invoices.

---

## Features

| Feature | Description |
|---|---|
| **Input compression** | Strips filler, hedging, whitespace from prompts before sending |
| **Output compression** | System prompt instructs model to reply terse (caveman-style) |
| **Chat history** | Full sidebar with auto-title, rename, delete, conversation loading |
| **Multi-model** | Switch between OpenAI, Anthropic, Groq, and OpenRouter models per chat |
| **Dashboard** | Tokens saved over time, compression breakdown, model usage, recent convos |
| **BYOK** | Bring your own API key per provider — used only when platform quota is reached |

Three compression levels: **Lite** (drop filler), **Full** (drop articles), **Ultra** (one word when one word enough).

---

## Tech stack

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Auth + DB:** Supabase (Auth + Postgres + RLS + pgcrypto)
- **LLM:** OpenAI, Anthropic, Groq, OpenRouter (multi-provider)
- **Charts:** Recharts
- **Hosting:** Vercel

---

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the base schema: [`supabase/schema.sql`](./supabase/schema.sql)
3. Then run each migration in order:
   - [`supabase/migrations/001_chat_history_updated_at.sql`](./supabase/migrations/001_chat_history_updated_at.sql)
   - [`supabase/migrations/002_models_table.sql`](./supabase/migrations/002_models_table.sql)
   - [`supabase/migrations/003_byok_tables.sql`](./supabase/migrations/003_byok_tables.sql)
   - [`supabase/migrations/004_messages_tokens_saved.sql`](./supabase/migrations/004_messages_tokens_saved.sql)
   - [`supabase/migrations/005_rpc_functions.sql`](./supabase/migrations/005_rpc_functions.sql)
4. Enable **Google OAuth** in Authentication → Providers (optional).
5. Add redirect URL: `https://your-app.vercel.app/auth/callback`

### 2. Environment variables

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (server-side only) |
| `LLM_API_KEY` | ✅ | OpenRouter API key (default/fallback) |
| `LLM_API_BASE_URL` | ✅ | Default LLM base URL |
| `LLM_MODEL` | ✅ | Default model ID |
| `OPENAI_API_KEY` | optional | Platform key for OpenAI models |
| `ANTHROPIC_API_KEY` | optional | Platform key for Anthropic models |
| `GROQ_API_KEY` | optional | Platform key for Groq models |
| `KEY_ENCRYPTION_SECRET` | ✅ for BYOK | Secret for pgcrypto key encryption. Generate: `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your deployment URL |

### 3. Local development

```bash
npm install
npm run dev
```

### 4. Deploy to Vercel

Connect the GitHub repo in Vercel dashboard — auto-deploys on push.
Add all env vars from the table above in **Settings → Environment Variables**.

---

## BYOK quota-fallback behaviour

For each provider, the server checks `platform_usage.tokens_used >= monthly_quota` before each request:

- **Under quota** → uses the platform API key (`OPENAI_API_KEY`, etc.)
- **Over quota** → looks up the user's own key in `user_api_keys` (decrypted server-side with `KEY_ENCRYPTION_SECRET`)
  - Key found → uses it; chat UI shows a **🔑 via your API key** label on that message
  - Key not found → returns HTTP 402 with a message prompting the user to add their key in Settings

User keys are stored encrypted via `pgp_sym_encrypt(raw_key, KEY_ENCRYPTION_SECRET)` — never plaintext, never sent to the client. Decryption happens only inside `/api/chat`, immediately before the outbound provider call.

To reset the quota counter, update `platform_usage.period_start` to the current month — or let the `increment_platform_usage` RPC auto-reset it on the first call of a new month.

---

## LLM providers

| Provider | Env var | Example model |
|---|---|---|
| OpenRouter | `LLM_API_KEY` | `mistralai/mistral-7b-instruct` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-haiku-3-5` |
| Groq | `GROQ_API_KEY` | `llama-3.1-8b-instant` |

---

## Credits

Output compression system prompt adapted from
[caveman](https://github.com/JuliusBrussee/caveman) (MIT) by Julius Brussee.
See [NOTICE](./NOTICE).

---

## License

MIT — see [LICENSE](./LICENSE).
