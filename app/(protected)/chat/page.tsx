import { createClient } from "@/lib/supabase/server";
import ChatInterface from "@/components/chat/ChatInterface";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileRes, modelsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("compression_level")
      .eq("id", user!.id)
      .single(),
    supabase
      .from("models")
      .select("*")
      .eq("is_active", true)
      .order("provider")
      .order("display_name"),
  ]);

  const compressionLevel = profileRes.data?.compression_level ?? "full";
  const models = modelsRes.data ?? [];
  const defaultModelId =
    models.find((m) => m.id === "gpt-4o-mini")?.id ??
    models[0]?.id ??
    "gpt-4o-mini";

  return (
    <ChatInterface
      initialCompressionLevel={compressionLevel}
      models={models}
      defaultModelId={defaultModelId}
    />
  );
}
