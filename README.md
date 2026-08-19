# ⛏ TokenSaver

AI chat with built-in compression. Strip filler from your prompts, get terse
technical replies — save tokens on both ends of every conversation.

> Token counts are **inferred** (offline BPE estimates). Not provider invoices.

---

## What it does

| Layer | What it compresses | How |
|---|---|---|
| **Input** | Your prompt | Strips filler phrases, redundant politeness, whitespace noise before sending |
| **Output** 
| The AI's reply | System prompt (ported from the [caveman](https://github.com/JuliusBrussee/caveman) skill) instructs the model to reply terse |
| **Dashboard** | — | Per-message and cumulative token/cost savings displayed live |

Three levels: **lite** (drop filler), **full** (drop articles, fragments OK), **ultra** (one word when one word enough).

---

## Tech stack

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Auth + DB:** Supabase (Auth + Postgres + RLS)
- **LLM:** Any OpenAI-compatible endpoint (OpenRouter / Groq / Ollama / etc.)
- **Hosting:** Vercel

---

## Setup

### 1. Supabase project

1. Create a new project at [supabase.com](https://supabase.com).
2. In **Dashboard → SQL Editor**, run the contents of [`supabase/schema.sql`](./supabase/schema.sql).
3. In **Dashboard → Authentication → Providers**, enable **Google** (add OAuth credentials from [Google Cloud Console](https://console.cloud.google.com)).
4. Add your app URL to **Dashboard → Authentication → URL Configuration**:
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: `https://your-app.vercel.app/auth/callback`

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `LLM_API_BASE_URL` | Your provider's base URL (see `.env.example`) |
| `LLM_API_KEY` | Your provider's API key |
| `LLM_MODEL` | Model name string (e.g. `mistralai/mistral-7b-instruct`) |
| `LLM_PRICE_PER_MILLION_TOKENS` | Optional: per-million input token price for cost estimates |

### 3. Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Deploy to Vercel

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Deploy
vercel

# Set env vars in Vercel dashboard or via CLI:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# ... etc for all vars in .env.example
```

Or connect your GitHub repo in the Vercel dashboard — it auto-deploys on push.

---

## LLM provider examples

| Provider | `LLM_API_BASE_URL` | Example model |
|---|---|---|
| [OpenRouter](https://openrouter.ai) | `https://openrouter.ai/api/v1` | `mistralai/mistral-7b-instruct` |
| [Groq](https://groq.com) | `https://api.groq.com/openai/v1` | `llama3-8b-8192` |
| [Ollama](https://ollama.com) (local) | `http://localhost:11434/v1` | `llama3` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |

---

## Architecture

```
User prompt
  ↓ lib/compression/input.ts — strip filler (rule-based)
  ↓ POST /api/chat — auth check + history fetch
  ↓ lib/compression/outputInstruction.ts — inject caveman system prompt
  ↓ LLM API (streaming)
  ↓ Stream SSE back to browser
  ↓ Log tokens + savings to Supabase
Browser ← token savings stats per message
```

### Compression extension point

To add model-based compression (LLMLingua, etc.), see the clearly marked
`TODO` at the bottom of `lib/compression/input.ts`.

---

## Credits

Output compression system prompt adapted from
[caveman](https://github.com/JuliusBrussee/caveman) (MIT) by Julius Brussee.
See [NOTICE](./NOTICE).

---

## License

MIT — see [LICENSE](./LICENSE).
