import { createClient } from "@/lib/supabase/server";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, compression_level")
    .eq("id", user!.id)
    .single();

  return (
    <SettingsClient
      initialProfile={{
        displayName: profile?.display_name ?? "",
        compressionLevel: profile?.compression_level ?? "full",
        email: user!.email ?? "",
      }}
    />
  );
}
