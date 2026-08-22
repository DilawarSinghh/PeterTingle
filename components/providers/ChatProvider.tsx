"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import type { Conversation, Message } from "@/types/database";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  originalContent?: string;
  modelId?: string | null;
  modelName?: string | null;
  keySource?: "platform" | "user" | null;
  stats?: {
    inputOriginalTokens: number;
    inputActualTokens: number;
    inputTokensSaved: number;
    inputPctSaved: number;
    outputActualTokens: number;
    totalTokensSaved: number;
    costSavedUsd: number;
    costKnown: boolean;
    keySource?: "platform" | "user" | null;
    usageFromProvider: boolean;
    basis: "provider" | "inferred";
  };
  streaming?: boolean;
  error?: boolean;
}

interface ChatContextValue {
  conversationId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  historyLoading: boolean;
  refreshTrigger: number;
  sidebarOpen: boolean;
  loadConversation: (conv: Conversation) => Promise<void>;
  startNewChat: () => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setConversationId: (id: string | null) => void;
  setIsStreaming: (v: boolean) => void;
  setHistoryLoading: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;
  toggleSidebar: () => void;
  bumpRefresh: () => void;
  abortRef: React.MutableRefObject<AbortController | null>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside ChatProvider");
  return ctx;
}

interface Props {
  children: React.ReactNode;
}

export default function ChatProvider({ children }: Props) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const loadConversation = useCallback(async (conv: Conversation) => {
    if (isStreaming) { abortRef.current?.abort(); setIsStreaming(false); }
    setHistoryLoading(true);
    setConversationId(conv.id);
    try {
      const res = await fetch(`/api/conversations/${conv.id}/messages`);
      const data = await res.json();
      setMessages((data.messages ?? []).map((m: Message) => ({
        id: m.id,
        role: m.role,
        content: (m.compressed_content ?? m.original_content) ?? "",
        originalContent: m.original_content ?? undefined,
        modelId: m.model_id,
        modelName: null,
        keySource: m.key_source,
      })));
    } catch { setMessages([]); }
    finally { setHistoryLoading(false); }
  }, [isStreaming]);

  const startNewChat = useCallback(() => {
    if (isStreaming) { abortRef.current?.abort(); setIsStreaming(false); }
    setMessages([]); setConversationId(null);
  }, [isStreaming]);

  const bumpRefresh = useCallback(() => setRefreshTrigger((n) => n + 1), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((o) => !o), []);

  return (
    <ChatContext.Provider value={{
      conversationId, messages, isStreaming, historyLoading, refreshTrigger, sidebarOpen,
      loadConversation, startNewChat, setMessages, setConversationId,
      setIsStreaming, setHistoryLoading, setSidebarOpen, toggleSidebar, bumpRefresh, abortRef,
    }}>
      {children}
    </ChatContext.Provider>
  );
}
