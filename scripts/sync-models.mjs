/**
 * scripts/sync-models.mjs
 * Syncs live model lists from Groq and NVIDIA NIM into Supabase `models`.
 * Run: node scripts/sync-models.mjs
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })
);

const { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY } = env;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing Supabase env"); process.exit(1); }

const PROVIDERS = [
  { provider: "groq", baseUrl: "https://api.groq.com/openai/v1", apiKey: env.GROQ_API_KEY },
  { provider: "nvidia", baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: env.NVIDIA_NIM_API_KEY },
];

const EXCLUDE = [/embed/i, /whisper/i, /tts/i, /dall-e/i, /moderation/i, /vision/i, /image/i, /audio/i, /transcri/i, /guard/i, /orpheus/i, /safeguard/i];

const headers = { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY, "Content-Type": "application/json" };

for (const cfg of PROVIDERS) {
  if (!cfg.apiKey || cfg.apiKey.startsWith("<")) { console.log(cfg.provider + ": skipped (no key)"); continue; }
  const res = await fetch(cfg.baseUrl + "/models", {
    headers: { Authorization: "Bearer " + cfg.apiKey }, signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) { console.error(cfg.provider + " fetch failed: " + res.status); continue; }
  const { data: raw } = await res.json();
  const live = (raw ?? []).filter((m) => m.id && !EXCLUDE.some((p) => p.test(m.id)));
  const liveIds = new Set(live.map((m) => m.id));
  console.log(cfg.provider + ": " + live.length + " live models");

  const rows = live.map((m) => ({
    id: m.id,
    display_name: m.id.split("/").pop().replace(/[-_]/g, " "),
    provider: cfg.provider,
    base_url: cfg.baseUrl,
    is_active: true,
  }));
  const up = await fetch(SUPABASE_URL + "/rest/v1/models?on_conflict=id", {
    method: "POST", headers: { ...headers, Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(rows),
  });
  if (!up.ok) { console.error(cfg.provider + " upsert failed: " + await up.text()); continue; }

  const existing = await fetch(SUPABASE_URL + "/rest/v1/models?select=id&provider=eq." + cfg.provider + "&is_active=eq.true", { headers }).then((r) => r.json());
  const stale = (existing ?? []).map((r) => r.id).filter((id) => !liveIds.has(id));
  if (stale.length) {
    const list = stale.map((id) => '"' + id + '"').join(",");
    await fetch(SUPABASE_URL + "/rest/v1/models?id=in.(" + encodeURIComponent(list) + ")", {
      method: "PATCH", headers, body: JSON.stringify({ is_active: false }),
    });
    console.log(cfg.provider + ": deactivated " + stale.length + " stale: " + stale.join(", "));
  }
  console.log(cfg.provider + ": done");
}
console.log("All providers synced.");
