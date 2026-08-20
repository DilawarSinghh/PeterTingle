/**
 * types/database.ts
 * TypeScript types mirroring the Supabase Postgres schema.
 */

export type CompressionLevel = "lite" | "full" | "ultra";

export interface Profile {
  id: string; // uuid — matches auth.users.id
  display_name: string | null;
  compression_level: CompressionLevel;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  original_content: string | null; // pre-compression (user messages)
  compressed_content: string | null; // what was actually sent to LLM
  raw_tokens: number | null;
  compressed_tokens: number | null;
  created_at: string;
}

export interface UsageLog {
  id: string;
  user_id: string;
  conversation_id: string | null;
  tokens_saved: number | null;
  cost_saved_usd: number | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Supabase Database generic type (used with createClient<Database>())
// ---------------------------------------------------------------------------

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at"> & { created_at?: string };
        Update: Partial<Omit<Profile, "id">>;
        Relationships: [];
      };
      conversations: {
        Row: Conversation;
        Insert: Omit<Conversation, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Conversation, "id">>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Message, "id">>;
        Relationships: [];
      };
      usage_logs: {
        Row: UsageLog;
        Insert: Omit<UsageLog, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<UsageLog, "id">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
