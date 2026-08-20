/**
 * types/database.ts
 * TypeScript types mirroring the Supabase Postgres schema.
 * Keep in sync with supabase/migrations/*.sql
 */

export type CompressionLevel = "lite" | "full" | "ultra";
export type Provider = "openai" | "anthropic" | "groq" | "openrouter" | "nvidia";
export type KeySource = "platform" | "user";

// ─── Core entities ────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  display_name: string | null;
  compression_level: CompressionLevel;
  created_at: string;
}

export interface Model {
  id: string;
  display_name: string;
  provider: Provider;
  base_url: string;
  is_active: boolean;
  input_cost_per_1k: number | null;
  output_cost_per_1k: number | null;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  default_model_id: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  original_content: string | null;
  compressed_content: string | null;
  raw_tokens: number | null;
  compressed_tokens: number | null;
  tokens_saved: number | null;
  compression_level: CompressionLevel | "none" | null;
  model_id: string | null;
  key_source: KeySource | null;
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

export interface UserApiKey {
  id: string;
  user_id: string;
  provider: Provider;
  encrypted_key: string;
  last_verified_at: string | null;
  created_at: string;
}

export interface PlatformUsage {
  provider: Provider;
  period_start: string;
  tokens_used: number;
  monthly_quota: number;
}

// ─── Supabase Database generic type ──────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at"> & { created_at?: string };
        Update: Partial<Omit<Profile, "id">>;
        Relationships: [];
      };
      models: {
        Row: Model;
        Insert: Model;
        Update: Partial<Model>;
        Relationships: [];
      };
      conversations: {
        Row: Conversation;
        Insert: Omit<Conversation, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
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
      user_api_keys: {
        Row: UserApiKey;
        Insert: Omit<UserApiKey, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<UserApiKey, "id">>;
        Relationships: [];
      };
      platform_usage: {
        Row: PlatformUsage;
        Insert: PlatformUsage;
        Update: Partial<PlatformUsage>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
