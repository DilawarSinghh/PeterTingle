import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/ui/Sidebar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, compression_level")
    .eq("id", user.id)
    .single();

  if (!profile) {
    await supabase.from("profiles").upsert({
      id: user.id,
      display_name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User",
      compression_level: "full",
    });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
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
