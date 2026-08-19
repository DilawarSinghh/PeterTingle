/**
 * lib/supabase/client.ts
 * Browser-side Supabase client (uses anon key — safe to expose in browser).
 * Import this in Client Components.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
