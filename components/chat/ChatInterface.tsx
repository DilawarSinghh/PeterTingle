"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { CompressionLevel, Model, Conversation, Message } from "@/types/database";
import MessageBubble from "./MessageBubble";
import TokenSavingsBadge from "./TokenSavingsBadge";
import CompressionToggle from "./CompressionToggle";
import ConversationList from "./ConversationList";
import ModelSelector from "./ModelSelector";

const SEND_TIMEOUT_MS = 60_000;

export interface MessageStats {
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

const STARTER_PROMPTS = [
  { label: "Explain a concept", text: "Explain how token compression reduces LLM API costs, simply." },
  { label: "Write something", text: "Write a short product tagline for a tool that saves LLM tokens." },
  { label: "Compare models", text: "What are the tradeoffs between small and large language models?" },
  { label: "Debug code", text: "Why might a fetch stream stall without an error in the browser?" },
];

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
  const [isWaiting, setIsWaiting] = useState(false);
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>(initialCompressionLevel);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionTokensSaved, setSessionTokensSaved] = useState(0);
  const [selectedModelId, setSelectedModelId] = useState(defaultModelId);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [convRefreshTrigger, setConvRefreshTrigger] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only auto-scroll when user is already near the bottom
  useEffect(() => {
    if (stickToBottom) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, stickToBottom]);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    setStickToBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  }

  // Auto-resize textarea up to ~8 lines
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 128) + "px";
  }, [input]);

  async function loadConversation(conv: Conversation) {
    if (isStreaming) { abortRef.current?.abort(); setIsStreaming(false); }
    setHistoryLoading(true);
    setConversationId(conv.id);
    setSessionTokensSaved(0);
    setStickToBottom(true);
    if (conv.default_model_id) setSelectedModelId(conv.default_model_id);
    try {
      const res = await fetch(`/api/conversations/${conv.id}/messages`);
      const data = await res.json();
      setMessages((data.messages ?? []).map((m: Message) => dbMessageToChatMessage(m, models)));
    } catch { setMessages([]); }
    finally { setHistoryLoading(false); }
  }

  function startNewChat() {
    if (isStreaming) { abortRef.current?.abort(); setIsStreaming(false); }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMessages([]); setConversationId(null); setSessionTokensSaved(0); setIsWaiting(false);
    setStickToBottom(true);
    inputRef.current?.focus();
  }

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isStreaming) return;

    setInput(""); setIsStreaming(true); setIsWaiting(true);
    setStickToBottom(true);

    const userMsgId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: userMsgId, role: "user", content: text }]);

    const asstMsgId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: asstMsgId, role: "assistant", content: "", streaming: true }]);

    abortRef.current = new AbortController();

    timeoutRef.current = setTimeout(() => {
      abortRef.current?.abort();
      setMessages((prev) => prev.map((m) =>
        m.id === asstMsgId
          ? { ...m, content: "Request timed out after 60 seconds. The provider may be overloaded — try again.", streaming: false, error: true }
          : m
      ));
      setIsStreaming(false); setIsWaiting(false);
    }, SEND_TIMEOUT_MS);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId, compressionEnabled, compressionLevel, modelId: selectedModelId }),
        signal: abortRef.current.signal,
      });

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages((prev) => prev.map((m) =>
          m.id === asstMsgId ? { ...m, content: `Error: ${err.error ?? "Something went wrong"}`, streaming: false, error: true } : m
        ));
        setIsStreaming(false); setIsWaiting(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let firstToken = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split("\n");
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
              if (firstToken) { setIsWaiting(false); firstToken = false; }
              setMessages((prev) => prev.map((m) =>
                m.id === asstMsgId ? { ...m, content: (m.content ?? "") + parsed.delta, streaming: true } : m
              ));
            }
            if (parsed.type === "stats") {
              const modelName = models.find((m) => m.id === selectedModelId)?.display_name ?? null;
              const stats: MessageStats = {
                inputOriginalTokens: parsed.inputOriginalTokens ?? 0,
                inputActualTokens: parsed.inputActualTokens ?? 0,
                inputTokensSaved: parsed.inputTokensSaved ?? 0,
                inputPctSaved: parsed.inputPctSaved ?? 0,
                outputActualTokens: parsed.outputActualTokens ?? 0,
                totalTokensSaved: parsed.totalTokensSaved ?? 0,
                costSavedUsd: parsed.costSavedUsd ?? 0,
                costKnown: parsed.costKnown ?? false,
                keySource: parsed.keySource ?? null,
                usageFromProvider: parsed.usageFromProvider ?? false,
                basis: parsed.basis ?? "inferred",
              };
              setMessages((prev) => prev.map((m) => {
                if (m.id === asstMsgId) return { ...m, streaming: false, stats, modelId: selectedModelId, modelName, keySource: parsed.keySource ?? null };
                if (m.id === userMsgId) return { ...m, originalContent: text, stats };
                return m;
              }));
              setSessionTokensSaved((prev) => prev + (parsed.totalTokensSaved ?? 0));
              setConvRefreshTrigger((n) => n + 1);
            }
          } catch { /* malformed SSE */ }
        }
      }
    } catch (err: unknown) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) => prev.map((m) =>
        m.id === asstMsgId ? { ...m, content: "Connection error. Try again.", streaming: false, error: true } : m
      ));
    } finally {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsStreaming(false); setIsWaiting(false);
    }
  }, [input, isStreaming, conversationId, compressionEnabled, compressionLevel, selectedModelId, models]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const selectedModel = models.find((m) => m.id === selectedModelId);

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* History sidebar */}
      {sidebarOpen && (
        <div className="w-60 shrink-0 flex flex-col border-r border-surface-3 bg-surface overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-surface-3">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">History</span>
            <button
              onClick={() => setSidebarOpen(false)}
              title="Hide history"
              className="rounded p-1 text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
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

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-surface-3 bg-surface/80 px-4 py-2.5 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title="Show history"
                className="rounded-md p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            {sessionTokensSaved > 0 && (
              <span className="savings-badge hidden sm:inline-flex" title="Tokens saved this session">
                ⛏ {sessionTokensSaved.toLocaleString()} tokens saved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {models.length > 0 && (
              <ModelSelector models={models} selectedId={selectedModelId} onChange={setSelectedModelId} disabled={isStreaming} />
            )}
            <CompressionToggle enabled={compressionEnabled} level={compressionLevel} onToggle={setCompressionEnabled} onLevelChange={setCompressionLevel} disabled={isStreaming} />
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollContainerRef} onScroll={handleScroll} className="chat-scroll flex-1 overflow-y-auto px-4 py-6">
          {historyLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <span className="logo-spinner text-accent">⛏</span> Loading messages…
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="w-full max-w-lg text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-accent-muted bg-accent-dim text-2xl text-accent shadow-accent-glow">
                  ⛏
                </div>
                <h2 className="mt-4 text-xl font-semibold text-text-primary">
                  Start a conversation
                </h2>
                <p className="mt-1.5 text-sm text-text-secondary">
                  {compressionEnabled
                    ? `Compression on · ${compressionLevel} mode — filler words are stripped before sending, so you pay for fewer tokens.`
                    : "Compression off. Messages are sent unmodified."}
                </p>
                {selectedModel && (
                  <p className="mt-1 text-xs text-text-muted">
                    Using <span className="text-accent">{selectedModel.display_name}</span>
                  </p>
                )}
                <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {STARTER_PROMPTS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => sendMessage(s.text)}
                      disabled={isStreaming}
                      className="card card-hover px-4 py-3 text-left disabled:opacity-40"
                    >
                      <p className="text-sm font-medium text-text-primary">{s.label}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{s.text}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className="message-enter space-y-1">
                  <MessageBubble message={msg} />
                  {msg.role === "assistant" && !msg.streaming && !msg.error && msg.stats && (
                    <div className="pl-2"><TokenSavingsBadge stats={msg.stats} /></div>
                  )}
                  {msg.role === "assistant" && !msg.streaming && !msg.error && (
                    <div className="pl-2 flex items-center gap-2 flex-wrap">
                      {msg.modelName && <span className="text-[10px] text-text-muted">{msg.modelName}</span>}
                      {msg.keySource === "user" && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-warning bg-warning-bg rounded-full px-2 py-0.5">
                          🔑 via your API key
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {isWaiting && (
                <div className="message-enter flex justify-start">
                  <div className="flex items-center gap-2 rounded-xl border border-surface-3 bg-surface px-4 py-3">
                    <span className="logo-spinner text-accent text-lg leading-none">⛏</span>
                    <span className="text-sm text-text-secondary">Thinking…</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-surface-3 bg-surface/80 px-4 py-3.5 backdrop-blur">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-2xl border border-surface-3 bg-surface-2 px-3 py-2 shadow-sm transition-all focus-within:border-accent-muted focus-within:shadow-accent-glow">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={compressionEnabled ? "Message — filler stripped automatically…" : "Type your message…"}
                rows={1}
                className="flex-1 resize-none bg-transparent py-1.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
                style={{ maxHeight: "8rem" }}
                disabled={isStreaming}
              />
              <button
                onClick={isStreaming ? () => abortRef.current?.abort() : () => sendMessage()}
                disabled={!isStreaming && !input.trim()}
                title={isStreaming ? "Stop generating" : "Send (Enter)"}
                className={"flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all " + (
                  isStreaming
                    ? "bg-error-bg text-error hover:bg-red-900"
                    : "bg-accent text-background hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed"
                )}
              >
                {isStreaming ? (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                )}
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-text-muted">
              <span>Enter to send · Shift+Enter for newline</span>
              <span>
                Actual counts from provider where available.{" "}
                <em>Baselines are estimates.</em>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
