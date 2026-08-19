/**
 * lib/compression/tokenCount.ts
 *
 * Token counting utilities using js-tiktoken (o200k_base, compatible with
 * GPT-4o / modern OpenAI models and a close approximation for other providers).
 * All counts are labeled `inferred` — they are offline BPE estimates, not
 * provider invoices.
 */

import { Tiktoken } from "js-tiktoken";
import o200k from "js-tiktoken/ranks/o200k_base";

// Singleton encoder — initialising is ~50ms, so we cache it module-level.
let _enc: Tiktoken | null = null;

function getEncoder() {
  if (!_enc) {
    _enc = new Tiktoken(o200k);
  }
  return _enc;
}

/**
 * Count tokens in a string.
 * Returns an integer estimate. Label this `inferred` in any UI surface.
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  try {
    const enc = getEncoder();
    return enc.encode(text).length;
  } catch {
    // Fallback: rough word-based approximation (1 token ≈ 0.75 words)
    return Math.ceil(text.split(/\s+/).length / 0.75);
  }
}

/**
 * Estimate the cost of a token count at a given per-token price (in USD).
 * Returns 0 when price is unknown. Never labels this `verified`.
 */
export function estimateCost(tokens: number, pricePerMillionTokens: number): number {
  return (tokens / 1_000_000) * pricePerMillionTokens;
}

/**
 * Compute savings between two token counts.
 */
export function computeSavings(rawTokens: number, compressedTokens: number): {
  saved: number;
  ratio: number; // 0–1 fraction saved
  pctSaved: number; // 0–100
} {
  if (rawTokens === 0) return { saved: 0, ratio: 0, pctSaved: 0 };
  const saved = Math.max(0, rawTokens - compressedTokens);
  const ratio = saved / rawTokens;
  return { saved, ratio, pctSaved: Math.round(ratio * 100) };
}

/** Default per-million price to use when no provider pricing is configured. */
export const DEFAULT_PRICE_PER_MILLION = 1.0; // $1/M tokens — conservative middle estimate
