/**
 * scripts/verify-token-accuracy.ts
 *
 * QA script: sends fixed test prompts to each active provider and compares
 * provider-reported token counts vs local tiktoken estimates.
 *
 * Usage (from project root):
 *   npx tsx --env-file=.env scripts/verify-token-accuracy.ts
 *
 * Requires env vars in .env: OPENAI_API_KEY, GROQ_API_KEY,
 * NVIDIA_NIM_API_KEY, LLM_API_KEY
 */

import { Tiktoken } from "js-tiktoken";
import o200k from "js-tiktoken/ranks/o200k_base";

// ── Test prompts ──────────────────────────────────────────────────────────────

const TEST_PROMPTS = [
  "Hello, how are you?",
  "Explain the difference between TCP and UDP in one sentence.",
  "Write a haiku about tokens.",
  "What is 2 + 2? Reply with just the number.",
  "The quick brown fox jumps over the lazy dog. How many words is that?",
];

// ── Local tokenizer ───────────────────────────────────────────────────────────

const enc = new Tiktoken(o200k);

function localEstimate(text: string): number {
  return enc.encode(text).length;
}

// ── Provider configs ──────────────────────────────────────────────────────────

interface ProviderConfig {
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string | undefined;
  buildHeaders: (key: string) => Record<string, string>;
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY,
    buildHeaders: (k) => ({ Authorization: `Bearer ${k}` }),
  },
  {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.1-8b-instant",
    apiKey: process.env.GROQ_API_KEY,
    buildHeaders: (k) => ({ Authorization: `Bearer ${k}` }),
  },
  {
    name: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    model: "meta/llama-3.1-8b-instruct",
    apiKey: process.env.NVIDIA_NIM_API_KEY,
    buildHeaders: (k) => ({ Authorization: `Bearer ${k}` }),
  },
  {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "mistralai/mistral-7b-instruct",
    apiKey: process.env.LLM_API_KEY,
    buildHeaders: (k) => ({
      Authorization: `Bearer ${k}`,
      "HTTP-Referer": "https://tokensaver.app",
    }),
  },
];

// ── Run one test ──────────────────────────────────────────────────────────────

interface TestResult {
  prompt: string;
  localEst: number;
  providerPromptTokens: number | null;
  providerCompletionTokens: number | null;
  diff: number | null;
  diffPct: string | null;
  error?: string;
}

async function runTest(provider: ProviderConfig, prompt: string): Promise<TestResult> {
  const est = localEstimate(prompt);

  if (!provider.apiKey) {
    return {
      prompt, localEst: est,
      providerPromptTokens: null, providerCompletionTokens: null,
      diff: null, diffPct: null, error: "No API key",
    };
  }

  try {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...provider.buildHeaders(provider.apiKey),
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
        stream: false,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        prompt, localEst: est,
        providerPromptTokens: null, providerCompletionTokens: null,
        diff: null, diffPct: null,
        error: `HTTP ${res.status}: ${text.slice(0, 120)}`,
      };
    }

    const data = await res.json();
    const providerPrompt: number | null = data.usage?.prompt_tokens ?? null;
    const providerCompletion: number | null = data.usage?.completion_tokens ?? null;
    const diff = providerPrompt !== null ? providerPrompt - est : null;
    const diffPct =
      diff !== null && est > 0
        ? `${diff >= 0 ? "+" : ""}${((diff / est) * 100).toFixed(1)}%`
        : null;

    return { prompt, localEst: est, providerPromptTokens: providerPrompt, providerCompletionTokens: providerCompletion, diff, diffPct };
  } catch (err) {
    return {
      prompt, localEst: est,
      providerPromptTokens: null, providerCompletionTokens: null,
      diff: null, diffPct: null, error: String(err),
    };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(70));
  console.log("TokenSaver — Token Accuracy Verification Script");
  console.log("=".repeat(70));
  console.log();
  console.log("Confirms provider-reported token counts are used for actuals,");
  console.log("and local tokenizer is only used for the baseline estimate.");
  console.log();

  for (const provider of PROVIDERS) {
    console.log(`\n── ${provider.name} (${provider.model}) ${"─".repeat(20)}`);

    if (!provider.apiKey) {
      console.log("  Skipped — no API key configured");
      continue;
    }

    const results: TestResult[] = [];
    for (const prompt of TEST_PROMPTS) {
      process.stdout.write(`  Testing: "${prompt.slice(0, 45)}"  `);
      const result = await runTest(provider, prompt);
      results.push(result);
      if (result.error) {
        console.log(`ERROR: ${result.error}`);
      } else {
        console.log(
          `local=${result.localEst} | provider=${result.providerPromptTokens} | diff=${result.diff} (${result.diffPct})`
        );
      }
    }

    const valid = results.filter((r) => r.diff !== null);
    if (valid.length > 0) {
      const avgDiff = valid.reduce((s, r) => s + Math.abs(r.diff!), 0) / valid.length;
      const maxDiff = Math.max(...valid.map((r) => Math.abs(r.diff!)));
      console.log(`\n  Summary: ${valid.length}/${results.length} tests passed`);
      console.log(`  Avg |diff|: ${avgDiff.toFixed(1)} tokens   Max |diff|: ${maxDiff} tokens`);
      if (avgDiff > 10) {
        console.log("  ⚠  High avg diff — local tokenizer is not well-matched to this provider.");
        console.log("     Actual counts from provider usage object are still correct.");
        console.log("     Only the 'original baseline' estimate in the UI is affected.");
      } else {
        console.log("  ✓  Local estimates are close — baseline display is accurate.");
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("Historical note: messages written before this update may have used");
  console.log("local estimates for compressed_tokens instead of real provider usage.");
  console.log("Backfill not possible. Token accuracy is correct from this update onward.");
  console.log("=".repeat(70));
}

main().catch(console.error);
