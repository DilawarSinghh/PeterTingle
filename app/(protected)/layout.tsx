import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/ui/Sidebar";
import type { Database } from "@/types/database";

type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, compression_level")
    .eq("id", user.id)
    .single();

  // Create profile if missing (first login via OAuth)
  if (!profile) {
    const newProfile: ProfileInsert = {
      id: user.id,
      display_name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User",
      compression_level: "full",
    };
    await supabase.from("profiles").upsert(newProfile);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        user={{
          email: user.email ?? "",
          displayName:
            profile?.display_name ??
            user.user_metadata?.full_name ??
            user.email?.split("@")[0] ??
            "User",
        }}
      />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
