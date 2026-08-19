"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { CompressionLevel } from "@/types/database";
import MessageBubble from "./MessageBubble";
import TokenSavingsBadge from "./TokenSavingsBadge";
import CompressionToggle from "./CompressionToggle";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  originalContent?: string; // pre-compression for user messages
  stats?: {
    inputRawTokens: number;
    inputCompressedTokens: number;
    inputTokensSaved: number;
    inputPctSaved: number;
    outputTokens: number;
    totalTokensSaved: number;
    costSavedUsd: number;
    basis: "inferred";
  };
  streaming?: boolean;
}

interface Props {
  initialCompressionLevel: CompressionLevel;
}

export default function ChatInterface({ initialCompressionLevel }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>(
    initialCompressionLevel
  );
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionTokensSaved, setSessionTokensSaved] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setIsStreaming(true);

    // Optimistic user message
    const userMsgId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: text },
    ]);

    // Placeholder for streaming assistant response
    const asstMsgId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: asstMsgId, role: "assistant", content: "", streaming: true },
    ]);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId,
          compressionEnabled,
          compressionLevel,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstMsgId
              ? {
                  ...m,
                  content: `Error: ${err.error ?? "Something went wrong"}`,
                  streaming: false,
                }
              : m
          )
        );
        setIsStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

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
            }

            if (parsed.type === "token" && parsed.delta) {
              assistantText += parsed.delta;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === asstMsgId
                    ? { ...m, content: assistantText, streaming: true }
                    : m
                )
              );
            }

            if (parsed.type === "stats") {
              // Finalise assistant message with stats
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id === asstMsgId) {
                    return { ...m, streaming: false, stats: { ...parsed } };
                  }
                  // Attach input stats to user message
                  if (m.id === userMsgId) {
                    return {
                      ...m,
                      originalContent: text,
                      stats: { ...parsed },
                    };
                  }
                  return m;
                })
              );
              setSessionTokensSaved((prev) => prev + (parsed.totalTokensSaved ?? 0));
            }
          } catch {
            // Malformed SSE chunk — skip
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstMsgId
            ? { ...m, content: "Connection error. Try again.", streaming: false }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, conversationId, compressionEnabled, compressionLevel]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function startNewChat() {
    if (isStreaming) {
      abortRef.current?.abort();
      setIsStreaming(false);
    }
    setMessages([]);
    setConversationId(null);
    setSessionTokensSaved(0);
    inputRef.current?.focus();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={startNewChat} className="btn-secondary text-xs">
            + New chat
          </button>
          {sessionTokensSaved > 0 && (
            <span className="savings-badge">
              ⛏ {sessionTokensSaved.toLocaleString()} tokens saved this session
            </span>
          )}
        </div>
        <CompressionToggle
          enabled={compressionEnabled}
          level={compressionLevel}
          onToggle={setCompressionEnabled}
          onLevelChange={setCompressionLevel}
        />
      </header>

      {/* Messages */}
      <div className="chat-scroll flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-4xl">⛏</p>
              <h2 className="mt-3 text-lg font-semibold text-gray-800">
                TokenSaver Chat
              </h2>
              <p className="mt-1 max-w-sm text-sm text-gray-500">
                {compressionEnabled
                  ? `Compression on · ${compressionLevel} mode. Input filler stripped, output prompted terse.`
                  : "Compression off. Messages sent unmodified."}
              </p>
            </div>
          </div>
        )}

        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className="message-enter space-y-1">
              <MessageBubble message={msg} />
              {/* Show savings under assistant messages */}
              {msg.role === "assistant" && msg.stats && !msg.streaming && (
                <div className="pl-2">
                  <TokenSavingsBadge stats={msg.stats} />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
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
              onClick={isStreaming ? () => abortRef.current?.abort() : sendMessage}
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
            Token counts are <em>inferred</em> estimates, not provider invoices.
          </p>
        </div>
      </div>
    </div>
  );
}
