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

  if (modelsRes.error) {
    console.error("[chat] failed to load models:", modelsRes.error.message);
  }

  // Default to a model whose provider actually has a working platform key,
  // so the first message never fails with "No API key configured".
  const validKey = (k: string | undefined) =>
    !!k && !k.trim().startsWith("<") && k.trim().length >= 10;

  const providerHasKey: Record<string, boolean> = {
    openai:     validKey(process.env.OPENAI_API_KEY),
    anthropic:  validKey(process.env.ANTHROPIC_API_KEY),
    groq:       validKey(process.env.GROQ_API_KEY),
    nvidia:     validKey(process.env.NVIDIA_NIM_API_KEY),
    openrouter: validKey(process.env.LLM_API_KEY),
  };

  const usable = models.filter((m) => providerHasKey[m.provider] ?? false);
  const pool = usable.length > 0 ? usable : models;

  const defaultModelId =
    pool.find((m) => m.id === "gpt-4o-mini")?.id ??
    pool.find((m) => m.provider === "groq")?.id ??
    pool.find((m) => m.provider === "nvidia")?.id ??
    pool[0]?.id ??
    "gpt-4o-mini";

  return (
    <ChatInterface
      initialCompressionLevel={compressionLevel}
      models={models}
      defaultModelId={defaultModelId}
    />
  );
}
