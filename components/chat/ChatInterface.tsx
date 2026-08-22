"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { CompressionLevel, Model } from "@/types/database";
import { useChat } from "@/components/providers/ChatProvider";
import MessageBubble from "./MessageBubble";
import TokenSavingsBadge from "./TokenSavingsBadge";
import CompressionToggle from "./CompressionToggle";
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
  "Explain how token compression reduces LLM API costs",
  "Write a short tagline for an AI token-saver app",
  "What are the tradeoffs between small and large language models?",
  "Debug: why might a fetch stream stall without an error?",
];

export default function ChatInterface({ initialCompressionLevel, models, defaultModelId }: Props) {
  const {
    conversationId, messages, setMessages, setConversationId, isStreaming, setIsStreaming,
    historyLoading, bumpRefresh, abortRef,
  } = useChat();

  const [input, setInput] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>(initialCompressionLevel);
  const [sessionTokensSaved, setSessionTokensSaved] = useState(0);
  const [selectedModelId, setSelectedModelId] = useState(defaultModelId);
  const [stickToBottom, setStickToBottom] = useState(true);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (stickToBottom) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, stickToBottom]);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    setStickToBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  }

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isStreaming) return;

    setInput(""); setIsStreaming(true); setIsWaiting(true); setStickToBottom(true);

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
              bumpRefresh();
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
              bumpRefresh();
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
  }, [input, isStreaming, conversationId, compressionEnabled, compressionLevel, selectedModelId, models, setMessages, setConversationId, bumpRefresh, abortRef]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-surface-3 bg-background pl-14 pr-4 sm:pl-4">
        <div className="flex items-center gap-2">
          {sessionTokensSaved > 0 && (
            <span className="savings-badge hidden sm:inline-flex">⛏ {sessionTokensSaved.toLocaleString()} saved</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <ModelSelector models={models} selectedId={selectedModelId} onChange={setSelectedModelId} disabled={isStreaming} />


          <CompressionToggle enabled={compressionEnabled} level={compressionLevel} onToggle={setCompressionEnabled} onLevelChange={setCompressionLevel} disabled={isStreaming} />
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="chat-scroll flex-1 overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-3xl px-3 pb-8 pt-4 sm:px-4 sm:pt-6">
          {historyLoading ? (
            <div className="flex h-full min-h-[40vh] items-center justify-center">
              <div className="text-sm text-text-secondary">Loading messages…</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
              <h1 className="text-2xl font-semibold text-text-primary sm:text-3xl">What can I help with?</h1>
              <div className="mt-8 grid w-full max-w-lg gap-3 sm:grid-cols-2">
                {STARTER_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(prompt)}
                    disabled={isStreaming}
                    className="rounded-xl border border-surface-3 bg-surface p-4 text-left text-sm text-text-secondary transition-colors hover:border-accent-muted hover:bg-surface-2 hover:text-text-primary"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className="message-enter">
                  <MessageBubble message={msg} />
                  {msg.role === "assistant" && !msg.streaming && !msg.error && msg.stats && (
                    <div className="mt-1 pl-1">
                      <TokenSavingsBadge stats={msg.stats} />
                    </div>
                  )}
                  {msg.role === "assistant" && !msg.streaming && !msg.error && (
                    <div className="mt-1 flex items-center gap-2 pl-1">
                      {msg.modelName && <span className="text-[11px] text-text-muted">{msg.modelName}</span>}
                      {msg.keySource === "user" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-[10px] text-warning">
                          🔑 via your key
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {isWaiting && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-lg border border-surface-3 bg-surface px-4 py-3">
                    <span className="logo-spinner text-accent text-lg leading-none">⛏</span>
                    <span className="text-sm text-text-secondary">Thinking…</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-surface-3 bg-background/80 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-4 sm:pt-4">
        <div className="mx-auto max-w-3xl">
          <div className="relative flex items-end gap-2 rounded-2xl border border-surface-3 bg-surface px-4 py-3 shadow-sm transition-all focus-within:border-accent-muted focus-within:shadow-accent-glow">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message TokenSaver…"
              rows={1}
              className="max-h-40 flex-1 resize-none bg-transparent py-1 text-base leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
              disabled={isStreaming}
            />
            <button
              onClick={isStreaming ? () => abortRef.current?.abort() : () => sendMessage()}
              disabled={!isStreaming && !input.trim()}
              title={isStreaming ? "Stop generating" : "Send (Enter)"}
              className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all " + (
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
          <p className="mt-2 text-center text-[11px] text-text-muted">
            TokenSaver can make mistakes. Token counts are estimates unless reported by the provider.
          </p>
        </div>
      </div>
    </div>
  );
}


