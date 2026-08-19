import { createClient } from "@/lib/supabase/server";
import ChatInterface from "@/components/chat/ChatInterface";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("compression_level")
    .eq("id", user!.id)
    .single();

  return (
    <ChatInterface
      initialCompressionLevel={profile?.compression_level ?? "full"}
    />
  );
}
