/**
 * lib/model-cost-overrides.ts
 *
 * Static cost map for known model IDs.
 * Values are in USD per 1,000 tokens.
 * Models NOT in this map will have null cost fields — the dashboard shows
 * "cost data unavailable" rather than a fabricated number.
 *
 * Sources: provider pricing pages (verified August 2026).
 * Update this file when providers change pricing.
 */

export interface CostOverride {
  input_cost_per_1k: number;   // USD per 1k input tokens
  output_cost_per_1k: number;  // USD per 1k output tokens
  display_name?: string;       // optional human-friendly name override
}

const COST_OVERRIDES: Record<string, CostOverride> = {
  // ── OpenAI ────────────────────────────────────────────────────────────────
  "gpt-4o":                        { input_cost_per_1k: 0.0025,   output_cost_per_1k: 0.01,    display_name: "GPT-4o" },
  "gpt-4o-mini":                   { input_cost_per_1k: 0.000150, output_cost_per_1k: 0.000600, display_name: "GPT-4o Mini" },
  "gpt-4o-mini-2024-07-18":        { input_cost_per_1k: 0.000150, output_cost_per_1k: 0.000600, display_name: "GPT-4o Mini (Jul 2024)" },
  "gpt-4-turbo":                   { input_cost_per_1k: 0.01,     output_cost_per_1k: 0.03,    display_name: "GPT-4 Turbo" },
  "gpt-3.5-turbo":                 { input_cost_per_1k: 0.0005,   output_cost_per_1k: 0.0015,  display_name: "GPT-3.5 Turbo" },
  "o1":                            { input_cost_per_1k: 0.015,    output_cost_per_1k: 0.06,    display_name: "o1" },
  "o1-mini":                       { input_cost_per_1k: 0.003,    output_cost_per_1k: 0.012,   display_name: "o1 Mini" },
  "o3-mini":                       { input_cost_per_1k: 0.0011,   output_cost_per_1k: 0.0044,  display_name: "o3 Mini" },

  // ── Anthropic ─────────────────────────────────────────────────────────────
  "claude-haiku-3-5":              { input_cost_per_1k: 0.0008,   output_cost_per_1k: 0.004,   display_name: "Claude 3.5 Haiku" },
  "claude-3-5-haiku-20241022":     { input_cost_per_1k: 0.0008,   output_cost_per_1k: 0.004,   display_name: "Claude 3.5 Haiku" },
  "claude-sonnet-3-5":             { input_cost_per_1k: 0.003,    output_cost_per_1k: 0.015,   display_name: "Claude 3.5 Sonnet" },
  "claude-3-5-sonnet-20241022":    { input_cost_per_1k: 0.003,    output_cost_per_1k: 0.015,   display_name: "Claude 3.5 Sonnet" },
  "claude-3-opus-20240229":        { input_cost_per_1k: 0.015,    output_cost_per_1k: 0.075,   display_name: "Claude 3 Opus" },
  "claude-3-haiku-20240307":       { input_cost_per_1k: 0.00025,  output_cost_per_1k: 0.00125, display_name: "Claude 3 Haiku" },

  // ── Groq ──────────────────────────────────────────────────────────────────
  "llama-3.1-8b-instant":          { input_cost_per_1k: 0.000050, output_cost_per_1k: 0.000080, display_name: "Llama 3.1 8B (Groq)" },
  "llama-3.1-70b-versatile":       { input_cost_per_1k: 0.000590, output_cost_per_1k: 0.000790, display_name: "Llama 3.1 70B (Groq)" },
  "llama-3.3-70b-versatile":       { input_cost_per_1k: 0.000590, output_cost_per_1k: 0.000790, display_name: "Llama 3.3 70B (Groq)" },
  "llama3-8b-8192":                { input_cost_per_1k: 0.000050, output_cost_per_1k: 0.000080, display_name: "Llama 3 8B (Groq)" },
  "llama3-70b-8192":               { input_cost_per_1k: 0.000590, output_cost_per_1k: 0.000790, display_name: "Llama 3 70B (Groq)" },
  "mixtral-8x7b-32768":            { input_cost_per_1k: 0.000240, output_cost_per_1k: 0.000240, display_name: "Mixtral 8x7B (Groq)" },
  "gemma2-9b-it":                  { input_cost_per_1k: 0.000200, output_cost_per_1k: 0.000200, display_name: "Gemma 2 9B (Groq)" },
  "deepseek-r1-distill-llama-70b": { input_cost_per_1k: 0.000750, output_cost_per_1k: 0.000990, display_name: "DeepSeek R1 70B (Groq)" },
  "qwen-qwq-32b":                  { input_cost_per_1k: 0.000290, output_cost_per_1k: 0.000390, display_name: "Qwen QwQ 32B (Groq)" },

  // ── NVIDIA NIM ────────────────────────────────────────────────────────────
  "meta/llama-3.1-8b-instruct":    { input_cost_per_1k: 0.000100, output_cost_per_1k: 0.000100, display_name: "Llama 3.1 8B (NVIDIA)" },
  "meta/llama-3.1-70b-instruct":   { input_cost_per_1k: 0.000350, output_cost_per_1k: 0.000400, display_name: "Llama 3.1 70B (NVIDIA)" },
  "meta/llama-3.1-405b-instruct":  { input_cost_per_1k: 0.001800, output_cost_per_1k: 0.001800, display_name: "Llama 3.1 405B (NVIDIA)" },
  "meta/llama-3.3-70b-instruct":   { input_cost_per_1k: 0.000350, output_cost_per_1k: 0.000400, display_name: "Llama 3.3 70B (NVIDIA)" },
  "nvidia/llama-3.1-nemotron-70b-instruct": { input_cost_per_1k: 0.000350, output_cost_per_1k: 0.000400, display_name: "Nemotron 70B (NVIDIA)" },
  "mistralai/mistral-7b-instruct":  { input_cost_per_1k: 0.000040, output_cost_per_1k: 0.000040, display_name: "Mistral 7B (NVIDIA)" },
  "mistralai/mixtral-8x7b-instruct":{ input_cost_per_1k: 0.000200, output_cost_per_1k: 0.000200, display_name: "Mixtral 8x7B (NVIDIA)" },
  "microsoft/phi-3-medium-128k-instruct": { input_cost_per_1k: 0.000100, output_cost_per_1k: 0.000100, display_name: "Phi-3 Medium (NVIDIA)" },
  "google/gemma-7b":               { input_cost_per_1k: 0.000100, output_cost_per_1k: 0.000100, display_name: "Gemma 7B (NVIDIA)" },

  // ── OpenRouter (select popular ones) ──────────────────────────────────────
  // Note: OpenRouter uses the same model IDs as providers, prefixed with org name.
  // These entries cover the OpenRouter-specific pricing for routing via their gateway.
  "mistralai/mistral-7b-instruct:openrouter":   { input_cost_per_1k: 0.000055, output_cost_per_1k: 0.000055, display_name: "Mistral 7B (OR)" },
  "meta-llama/llama-3.1-8b-instruct":           { input_cost_per_1k: 0.000055, output_cost_per_1k: 0.000055, display_name: "Llama 3.1 8B (OR)" },
  "meta-llama/llama-3.1-70b-instruct":          { input_cost_per_1k: 0.000400, output_cost_per_1k: 0.000400, display_name: "Llama 3.1 70B (OR)" },
  "tencent/hy3":                                { input_cost_per_1k: 0.000126, output_cost_per_1k: 0.000522, display_name: "HunyuanLarge (OR)" },
  "google/gemini-flash-1.5":                    { input_cost_per_1k: 0.000038, output_cost_per_1k: 0.000150, display_name: "Gemini Flash 1.5 (OR)" },
  "google/gemini-pro-1.5":                      { input_cost_per_1k: 0.001250, output_cost_per_1k: 0.005000, display_name: "Gemini Pro 1.5 (OR)" },
};

export default COST_OVERRIDES;

/** Look up cost data for a model — returns null fields if unknown */
export function getModelCost(modelId: string): CostOverride | null {
  return COST_OVERRIDES[modelId] ?? null;
}

/** Get display name from override map, fall back to formatted model ID */
export function getDisplayName(modelId: string): string {
  const override = COST_OVERRIDES[modelId];
  if (override?.display_name) return override.display_name;
  // Format the raw ID into something readable: "meta/llama-3.1-8b-instruct" → "llama-3.1-8b-instruct"
  const short = modelId.includes("/") ? modelId.split("/").pop()! : modelId;
  return short.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
