"use client";

import type { ChatMessage } from "./ChatInterface";

interface Props {
  message: ChatMessage;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-accent-muted text-text-primary border border-accent-dim"
            : "bg-surface text-text-primary border border-surface-3"
        }`}
      >
        {isUser &&
          message.originalContent &&
          message.content !== message.originalContent && (
            <p className="mb-1.5 text-xs text-accent opacity-70">✂ Input compressed</p>
          )}

        <p
          className={`whitespace-pre-wrap break-words ${
            message.streaming ? "streaming-cursor" : ""
          } ${message.error ? "text-error" : ""}`}
        >
          {message.content || (message.streaming ? "" : "…")}
        </p>
      </div>
    </div>
  );
}
