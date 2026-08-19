/**
 * lib/compression/input.ts
 *
 * Rule-based input compressor. Strips filler, redundant phrasing, and
 * whitespace noise from user prompts before they reach the LLM — shrinking
 * input tokens without changing the semantic request.
 *
 * Design decisions:
 * - Rule-based only. Fast, deterministic, zero latency, zero cost.
 * - Extension point clearly marked for model-based compression (LLMLingua etc.)
 * - Returns both the compressed string AND estimated token counts so callers
 *   can log savings without a second tokenizer call.
 * - All savings are `inferred` (offline BPE estimate).
 */

import { countTokens } from "./tokenCount";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompressionLevel = "lite" | "full" | "ultra";

export interface InputCompressionResult {
  original: string;
  compressed: string;
  rawTokens: number;
  compressedTokens: number;
  /** Always "inferred" — offline BPE estimate, not a provider invoice. */
  basis: "inferred";
}

// ---------------------------------------------------------------------------
// Filler phrase lists (sorted longest-first so longer matches win)
// ---------------------------------------------------------------------------

/** Phrases to strip in ALL modes (lite / full / ultra). */
const FILLER_ALWAYS: RegExp[] = [
  /\bI\s+was\s+wondering\s+if\s+(?:you\s+could\s+)?/gi,
  /\bcould\s+you\s+please\s+/gi,
  /\bwould\s+you\s+mind\s+/gi,
  /\bI\s+just\s+wanted\s+to\s+(?:ask|know|check|confirm)\s+/gi,
  /\bjust\s+wanted\s+to\s+say\s+that\s+/gi,
  /\bI\s+hope\s+(?:you\s+(?:are|can\s+help)|this\s+(?:is\s+okay|makes\s+sense))[^.!?]*[.!?]?\s*/gi,
  /\bthank\s+you\s+(?:so\s+much\s+)?(?:in\s+advance|for\s+your\s+help)[^.!?]*[.!?]?\s*/gi,
  /\bthanks\s+(?:so\s+much\s+)?(?:in\s+advance|for\s+your\s+help)[^.!?]*[.!?]?\s*/gi,
  /\bif\s+(?:that\s+)?(?:is|makes\s+sense|it\s+is\s+possible)[,\s]*/gi,
];

/** Additional phrases stripped in full + ultra modes. */
const FILLER_FULL: RegExp[] = [
  /\bbasically\s+/gi,
  /\bactually\s+/gi,
  /\bjust\s+(?=\w)/gi,
  /\breally\s+/gi,
  /\bsimply\s+/gi,
  /\bkind\s+of\s+/gi,
  /\bsort\s+of\s+/gi,
  /\blike\s+(?=I|we|you|they|a|an|the)\s+/gi,
  /\bfeel\s+free\s+to\s+/gi,
  /\bI\s+think\s+(?:that\s+)?/gi,
  /\bI\s+(?:believe|feel|guess)\s+(?:that\s+)?/gi,
  /\bI\s+was\s+thinking\s+(?:that\s+)?/gi,
  /\bas\s+you\s+(?:may|might|probably)\s+(?:know|be\s+aware)[,\s]*/gi,
  /\b(?:obviously|clearly|certainly|definitely|absolutely)\s+/gi,
  /\bof\s+course[,\s]*/gi,
  /\bno\s+problem[,\s]*/gi,
];

/** Additional aggressive strips for ultra mode. */
const FILLER_ULTRA: RegExp[] = [
  /\bI\s+(?:am|'m)\s+looking\s+(?:for|to)\s+/gi,
  /\bI\s+need\s+(?:you\s+to\s+)?(?:help\s+me\s+)?/gi,
  /\bcan\s+you\s+(?:please\s+)?(?:help\s+me\s+(?:with\s+)?)?/gi,
  /\bhelp\s+me\s+(?:understand\s+)?/gi,
  /\bI\s+would\s+(?:like|love)\s+(?:to\s+|you\s+to\s+)?/gi,
  /\bplease\s+/gi,
  /\bcould\s+you\s+/gi,
  /\bdo\s+you\s+(?:know|think)\s+/gi,
  /\bwhat\s+(?:is\s+the\s+best\s+way|would\s+be\s+the\s+best\s+way)\s+to\s+/gi,
  /\bhow\s+(?:do\s+I|should\s+I|can\s+I)\s+/gi,
];

// ---------------------------------------------------------------------------
// Whitespace / structural cleanup (all modes)
// ---------------------------------------------------------------------------

function normaliseWhitespace(text: string): string {
  return text
    // Collapse 3+ newlines to 2
    .replace(/\n{3,}/g, "\n\n")
    // Collapse multiple spaces / tabs to single space
    .replace(/[ \t]+/g, " ")
    // Trim lines
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Core compressor
// ---------------------------------------------------------------------------

function applyPatterns(text: string, patterns: RegExp[]): string {
  let out = text;
  for (const p of patterns) {
    out = out.replace(p, " ");
  }
  return out;
}

/**
 * Compress a user prompt using rule-based stripping.
 *
 * @param text   - The raw user input.
 * @param level  - Compression intensity: lite | full (default) | ultra
 * @returns      - Compression result with token counts (basis: "inferred").
 */
export function compressInput(
  text: string,
  level: CompressionLevel = "full"
): InputCompressionResult {
  const rawTokens = countTokens(text);

  let compressed = text;

  // Always apply the baseline filler set
  compressed = applyPatterns(compressed, FILLER_ALWAYS);

  if (level === "full" || level === "ultra") {
    compressed = applyPatterns(compressed, FILLER_FULL);
  }

  if (level === "ultra") {
    compressed = applyPatterns(compressed, FILLER_ULTRA);
  }

  // Normalise whitespace in all modes
  compressed = normaliseWhitespace(compressed);

  // If compression actually made it longer (shouldn't happen, but be safe),
  // return original — never inflate.
  if (compressed.length > text.length) {
    compressed = text.trim();
  }

  const compressedTokens = countTokens(compressed);

  return {
    original: text,
    compressed,
    rawTokens,
    compressedTokens,
    basis: "inferred",
  };
}

// ---------------------------------------------------------------------------
// TODO: model-based compression extension point
// ---------------------------------------------------------------------------
//
// To add LLMLingua-style compression, implement the interface below and
// replace the `compressInput` call in /api/chat with `compressInputModel`.
//
// export interface ModelCompressor {
//   compress(text: string, ratio: number): Promise<string>;
// }
//
// export async function compressInputModel(
//   text: string,
//   level: CompressionLevel,
//   compressor: ModelCompressor
// ): Promise<InputCompressionResult> {
//   const rawTokens = countTokens(text);
//   const ratioMap: Record<CompressionLevel, number> = {
//     lite: 0.8,
//     full: 0.6,
//     ultra: 0.4,
//   };
//   const compressed = await compressor.compress(text, ratioMap[level]);
//   const compressedTokens = countTokens(compressed);
//   return { original: text, compressed, rawTokens, compressedTokens, basis: "inferred" };
// }
