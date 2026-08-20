"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { CompressionLevel, Model, Conversation, Message } from "@/types/database";
import MessageBubble from "./MessageBubble";
import TokenSavingsBadge from "./TokenSavingsBadge";
import CompressionToggle from "./CompressionToggle";
import ConversationList from "./ConversationList";
import ModelSelector from "./ModelSelector";

const SEND_TIMEOUT_MS = 60_000; // 60 seconds

export interface MessageStats {
  inputOriginalTokens: number;   // local estimate — hypothetical "without compression"
  inputActualTokens: number;     // real provider usage (or fallback estimate)
  inputTokensSaved: number;
  inputPctSaved: number;
  outputActualTokens: number;    // real provider usage (or fallback estimate)
  totalTokensSaved: number;
  costSavedUsd: number;
  costKnown: boolean;
  keySource?: "platform" | "user" | null;
  usageFromProvider: boolean;    // true = real counts, false = local estimate fallback
  basis: "provider" | "inferred";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  originalContent?: string;
  modelId?: string | null;
  modelName?: string | null;
  keySource?: "platform" | "user" | null;
  stats?: MessageStats;
  streaming?: boolean;
  error?: boolean;
}

interface Props {
  initialCompressionLevel: CompressionLevel;
  models: Model[];
  defaultModelId: string;
}

function dbMessageToChatMessage(m: Message, models: Model[]): ChatMessage {
  const modelName = models.find((mod) => mod.id === m.model_id)?.display_name ?? null;
  return {
    id: m.id,
    role: m.role,
    content: (m.compressed_content ?? m.original_content) ?? "",
    originalContent: m.original_content ?? undefined,
    modelId: m.model_id,
    modelName,
    keySource: m.key_source,
  };
}

export default function ChatInterface({ initialCompressionLevel, models, defaultModelId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false); // true = sent, waiting for first token
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>(initialCompressionLevel);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionTokensSaved, setSessionTokensSaved] = useState(0);
  const [selectedModelId, setSelectedModelId] = useState(defaultModelId);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [convRefreshTrigger, setConvRefreshTrigger] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup timeout on unmount
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  async function loadConversation(conv: Conversation) {
    if (isStreaming) { abortRef.current?.abort(); setIsStreaming(false); }
    setHistoryLoading(true);
    setConversationId(conv.id);
    setSessionTokensSaved(0);
    if (conv.default_model_id) setSelectedModelId(conv.default_model_id);

    try {
      const res = await fetch(`/api/conversations/${conv.id}/messages`);
      const data = await res.json();
      const msgs: ChatMessage[] = (data.messages ?? []).map((m: Message) =>
        dbMessageToChatMessage(m, models)
      );
      setMessages(msgs);
    } catch {
      setMessages([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function startNewChat() {
    if (isStreaming) { abortRef.current?.abort(); setIsStreaming(false); }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMessages([]);
    setConversationId(null);
    setSessionTokensSaved(0);
    setIsWaiting(false);
    inputRef.current?.focus();
  }

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setIsStreaming(true);
    setIsWaiting(true);

    const userMsgId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: userMsgId, role: "user", content: text }]);

    const asstMsgId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: asstMsgId, role: "assistant", content: "", streaming: true },
    ]);

    abortRef.current = new AbortController();

    // 60-second client-side timeout
    timeoutRef.current = setTimeout(() => {
      abortRef.current?.abort();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstMsgId
            ? {
                ...m,
                content: "Request timed out after 60 seconds. The provider may be overloaded — try again.",
                streaming: false,
                error: true,
              }
            : m
        )
      );
      setIsStreaming(false);
      setIsWaiting(false);
    }, SEND_TIMEOUT_MS);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId,
          compressionEnabled,
          compressionLevel,
          modelId: selectedModelId,
        }),
        signal: abortRef.current.signal,
      });

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstMsgId
              ? { ...m, content: `Error: ${err.error ?? "Something went wrong"}`, streaming: false, error: true }
              : m
          )
        );
        setIsStreaming(false);
        setIsWaiting(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let firstToken = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === "meta" && parsed.conversationId) {
              setConversationId(parsed.conversationId);
              setConvRefreshTrigger((n) => n + 1);
            }

            if (parsed.type === "token" && parsed.delta) {
              if (firstToken) {
                setIsWaiting(false); // first token arrived — stop spinner
                firstToken = false;
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === asstMsgId
                    ? { ...m, content: (m.content ?? "") + parsed.delta, streaming: true }
                    : m
                )
              );
            }

            if (parsed.type === "stats") {
              const modelName = models.find((m) => m.id === selectedModelId)?.display_name ?? null;
              const stats: MessageStats = {
                inputOriginalTokens: parsed.inputOriginalTokens ?? parsed.inputRawTokens ?? 0,
                inputActualTokens: parsed.inputActualTokens ?? parsed.inputCompressedTokens ?? 0,
                inputTokensSaved: parsed.inputTokensSaved ?? 0,
                inputPctSaved: parsed.inputPctSaved ?? 0,
                outputActualTokens: parsed.outputActualTokens ?? parsed.outputTokens ?? 0,
                totalTokensSaved: parsed.totalTokensSaved ?? 0,
                costSavedUsd: parsed.costSavedUsd ?? 0,
                costKnown: parsed.costKnown ?? false,
                keySource: parsed.keySource ?? null,
                usageFromProvider: parsed.usageFromProvider ?? false,
                basis: parsed.basis ?? "inferred",
              };
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id === asstMsgId) return { ...m, streaming: false, stats, modelId: selectedModelId, modelName, keySource: parsed.keySource ?? null };
                  if (m.id === userMsgId) return { ...m, originalContent: text, stats };
                  return m;
                })
              );
              setSessionTokensSaved((prev) => prev + (parsed.totalTokensSaved ?? 0));
              setConvRefreshTrigger((n) => n + 1);
            }
          } catch { /* malformed SSE chunk */ }
        }
      }
    } catch (err: unknown) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstMsgId
            ? { ...m, content: "Connection error. Try again.", streaming: false, error: true }
            : m
        )
      );
    } finally {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsStreaming(false);
      setIsWaiting(false);
    }
  }, [input, isStreaming, conversationId, compressionEnabled, compressionLevel, selectedModelId, models]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const controlsDisabled = isStreaming;

  return (
    <div className="flex h-full overflow-hidden">
      {/* History sidebar */}
      {sidebarOpen && (
        <div className="w-52 shrink-0 flex flex-col border-r border-gray-200 bg-gray-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">History</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden py-2">
            <ConversationList
              activeId={conversationId}
              onSelect={loadConversation}
              onNew={startNewChat}
              onDeleted={(id) => { if (conversationId === id) startNewChat(); }}
              onRenamed={() => {}}
              refreshTrigger={convRefreshTrigger}
            />
          </div>
        </div>
      )}

      {/* Main chat */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 gap-3">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            {sessionTokensSaved > 0 && (
              <span className="savings-badge hidden sm:inline-flex">
                ⛏ {sessionTokensSaved.toLocaleString()} tokens saved this session
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {models.length > 0 && (
              <ModelSelector
                models={models}
                selectedId={selectedModelId}
                onChange={setSelectedModelId}
                disabled={controlsDisabled}
              />
            )}
            <CompressionToggle
              enabled={compressionEnabled}
              level={compressionLevel}
              onToggle={setCompressionEnabled}
              onLevelChange={setCompressionLevel}
              disabled={controlsDisabled}
            />
          </div>
        </header>

        {/* Messages */}
        <div className="chat-scroll flex-1 overflow-y-auto px-4 py-6">
          {historyLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-sm text-gray-400">Loading messages…</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-4xl">⛏</p>
                <h2 className="mt-3 text-lg font-semibold text-gray-800">TokenSaver Chat</h2>
                <p className="mt-1 max-w-sm text-sm text-gray-500">
                  {compressionEnabled
                    ? `Compression on · ${compressionLevel} mode.`
                    : "Compression off. Messages sent unmodified."}
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className="message-enter space-y-1">
                  <MessageBubble message={msg} />
                  {msg.role === "assistant" && !msg.streaming && !msg.error && msg.stats && (
                    <div className="pl-2">
                      <TokenSavingsBadge stats={msg.stats} />
                    </div>
                  )}
                  {msg.role === "assistant" && !msg.streaming && !msg.error && (
                    <div className="pl-2 flex items-center gap-2 flex-wrap">
                      {msg.modelName && (
                        <span className="text-[10px] text-gray-400">{msg.modelName}</span>
                      )}
                      {msg.keySource === "user" && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                          🔑 via your API key
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Waiting spinner — shown before first token arrives */}
              {isWaiting && (
                <div className="message-enter flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
                    <span className="logo-spinner text-brand-600 text-lg leading-none">⛏</span>
                    <span className="text-sm text-gray-400">Thinking…</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white px-4 py-4">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  compressionEnabled
                    ? "Type your message — filler stripped automatically…"
                    : "Type your message…"
                }
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm outline-none placeholder-gray-400"
                style={{ maxHeight: "8rem" }}
                disabled={isStreaming}
              />
              <button
                onClick={isStreaming ? () => { abortRef.current?.abort(); } : sendMessage}
                disabled={!isStreaming && !input.trim()}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isStreaming
                    ? "bg-red-100 text-red-600 hover:bg-red-200"
                    : "btn-primary"
                }`}
              >
                {isStreaming ? "Stop" : "Send"}
              </button>
            </div>
            <p className="mt-1.5 text-center text-xs text-gray-400">
              Actual token counts from provider where available.{" "}
              <em>Original/baseline counts are inferred estimates.</em>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
