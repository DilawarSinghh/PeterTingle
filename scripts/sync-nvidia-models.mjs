/**
 * scripts/sync-nvidia-models.mjs
 * One-off sync of NVIDIA NIM models into the Supabase `models` table.
 * Mirrors lib/models-sync.ts (usable without a running Next dev server).
 * Run: node scripts/sync-nvidia-models.mjs
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })
);

const { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, NVIDIA_NIM_API_KEY: NIM_KEY } = env;
for (const [name, val] of Object.entries({ SUPABASE_URL, SERVICE_KEY, NIM_KEY })) {
  if (!val) { console.error("Missing " + name + " in .env"); process.exit(1); }
}

const BASE_URL = "https://integrate.api.nvidia.com/v1";
const EXCLUDE_PATTERNS = [/embed/i, /whisper/i, /tts/i, /dall-e/i, /moderation/i, /vision/i, /image/i, /audio/i, /transcri/i];

const res = await fetch(BASE_URL + "/models", {
  headers: { Authorization: "Bearer " + NIM_KEY, "Content-Type": "application/json" },
  signal: AbortSignal.timeout(20000),
});
if (!res.ok) { console.error("NVIDIA /models returned " + res.status + ": " + await res.text()); process.exit(1); }

const { data: rawModels } = await res.json();
const liveModels = (rawModels ?? []).filter((m) => m.id && !EXCLUDE_PATTERNS.some((p) => p.test(m.id)));
console.log("Fetched " + (rawModels?.length ?? 0) + " models, " + liveModels.length + " after exclusions");

const liveIds = new Set(liveModels.map((m) => m.id));

const headers = { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY, "Content-Type": "application/json" };

const rows = liveModels.map((m) => ({
  id: m.id,
  display_name: m.id.split("/").pop().replace(/[-_]/g, " "),
  provider: "nvidia",
  base_url: BASE_URL,
  is_active: true,
}));

const up = await fetch(SUPABASE_URL + "/rest/v1/models?on_conflict=id", {
  method: "POST",
  headers: { ...headers, Prefer: "resolution=merge-duplicates" },
  body: JSON.stringify(rows),
});
if (!up.ok) { console.error("Upsert failed " + up.status + ": " + await up.text()); process.exit(1); }
console.log("Upserted " + rows.length + " NVIDIA models");

const existing = await fetch(SUPABASE_URL + "/rest/v1/models?select=id&provider=eq.nvidia&is_active=eq.true", { headers }).then((r) => r.json());
const toDeactivate = (existing ?? []).map((r) => r.id).filter((id) => !liveIds.has(id));
if (toDeactivate.length > 0) {
  const list = toDeactivate.map((id) => '"' + id + '"').join(",");
  const deact = await fetch(SUPABASE_URL + "/rest/v1/models?id=in.(" + encodeURIComponent(list) + ")", {
    method: "PATCH", headers, body: JSON.stringify({ is_active: false }),
  });
  if (!deact.ok) console.error("Deactivate failed: " + await deact.text());
  else console.log("Deactivated " + toDeactivate.length + " removed models");
}
console.log("Done. NVIDIA NIM models are now live in the model selector.");
