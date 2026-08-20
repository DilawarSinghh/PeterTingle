/**
 * lib/models-sync.ts
 *
 * Fetches available models from Groq and NVIDIA NIM, then upserts them
 * into the public.models table. Marks disappeared models as is_active=false
 * (never hard-deletes, since messages reference model_id via FK).
 *
 * Called by POST /api/admin/sync-models and by the Vercel cron job daily.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getModelCost, getDisplayName } from "@/lib/model-cost-overrides";

// ── Provider configs ──────────────────────────────────────────────────────────

interface ProviderConfig {
  provider: string;
  baseUrl: string;
  modelsEndpoint: string;
  apiKey: string | undefined;
  authHeader: (key: string) => Record<string, string>;
}

const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    provider: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    modelsEndpoint: "https://api.groq.com/openai/v1/models",
    apiKey: process.env.GROQ_API_KEY,
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  {
    provider: "nvidia",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    modelsEndpoint: "https://integrate.api.nvidia.com/v1/models",
    apiKey: process.env.NVIDIA_NIM_API_KEY,
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
];

// Model IDs to exclude from syncing (system/embedding/moderation models)
const EXCLUDE_PATTERNS = [
  /embed/i, /whisper/i, /tts/i, /dall-e/i, /moderation/i,
  /vision/i, /image/i, /audio/i, /transcri/i,
];

function shouldExclude(id: string): boolean {
  return EXCLUDE_PATTERNS.some((p) => p.test(id));
}

// ── Fetch models from one provider ───────────────────────────────────────────

interface RawModel {
  id: string;
  [key: string]: unknown;
}

async function fetchProviderModels(config: ProviderConfig): Promise<RawModel[]> {
  if (!config.apiKey) {
    console.log(`[models-sync] Skipping ${config.provider} — no API key configured`);
    return [];
  }

  try {
    const res = await fetch(config.modelsEndpoint, {
      headers: {
        ...config.authHeader(config.apiKey),
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`[models-sync] ${config.provider} models endpoint returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    // Both Groq and NVIDIA return OpenAI-shaped: { data: [{ id, ... }] }
    const models: RawModel[] = data?.data ?? [];
    return models.filter((m) => m.id && !shouldExclude(m.id));
  } catch (err) {
    console.error(`[models-sync] Failed to fetch ${config.provider} models:`, err);
    return [];
  }
}

// ── Main sync function ────────────────────────────────────────────────────────

export interface SyncResult {
  provider: string;
  fetched: number;
  upserted: number;
  deactivated: number;
  error?: string;
}

export async function syncProviderModels(): Promise<SyncResult[]> {
  const serviceClient = createServiceClient();
  const results: SyncResult[] = [];

  for (const config of PROVIDER_CONFIGS) {
    const result: SyncResult = {
      provider: config.provider,
      fetched: 0,
      upserted: 0,
      deactivated: 0,
    };

    if (!config.apiKey) {
      result.error = "No API key configured";
      results.push(result);
      continue;
    }

    // Fetch live models
    const liveModels = await fetchProviderModels(config);
    result.fetched = liveModels.length;

    if (liveModels.length === 0) {
      result.error = "No models returned from provider";
      results.push(result);
      continue;
    }

    const liveIds = new Set(liveModels.map((m) => m.id));

    // Upsert each live model
    const upsertRows = liveModels.map((m) => {
      const cost = getModelCost(m.id);
      const displayName = getDisplayName(m.id);
      return {
        id: m.id,
        display_name: displayName,
        provider: config.provider,
        base_url: config.baseUrl,
        is_active: true,
        input_cost_per_1k: cost?.input_cost_per_1k ?? null,
        output_cost_per_1k: cost?.output_cost_per_1k ?? null,
      };
    });

    const { error: upsertError } = await (serviceClient as any)
      .from("models")
      .upsert(upsertRows, { onConflict: "id" });

    if (upsertError) {
      result.error = upsertError.message;
      results.push(result);
      continue;
    }
    result.upserted = upsertRows.length;

    // Mark disappeared models as inactive (don't delete — FK references exist)
    const { data: existingRows } = await (serviceClient as any)
      .from("models")
      .select("id")
      .eq("provider", config.provider)
      .eq("is_active", true);

    const toDeactivate = (existingRows ?? [])
      .map((r: { id: string }) => r.id)
      .filter((id: string) => !liveIds.has(id));

    if (toDeactivate.length > 0) {
      await (serviceClient as any)
        .from("models")
        .update({ is_active: false })
        .in("id", toDeactivate);
      result.deactivated = toDeactivate.length;
    }

    results.push(result);
    console.log(
      `[models-sync] ${config.provider}: ${result.upserted} upserted, ${result.deactivated} deactivated`
    );
  }

  return results;
}
