"use client";

import type { ChatMessage } from "./ChatInterface";

interface Props {
  message: ChatMessage;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[92%] sm:max-w-[75%] ${isUser ? "ml-4 sm:ml-12" : "mr-4 sm:mr-12"}`}>
        {isUser && message.originalContent && message.content !== message.originalContent && (
          <p className="mb-1 text-[11px] text-accent opacity-80">✂ Input compressed</p>
        )}
        <div
          className={isUser
            ? "rounded-2xl rounded-br-md bg-accent-dim px-5 py-3 text-text-primary"
            : "text-text-primary"
          }
        >
          <p className={`whitespace-pre-wrap break-words text-base leading-relaxed ${message.streaming ? "streaming-cursor" : ""} ${message.error ? "text-error" : ""}`}>
            {message.content || (message.streaming ? "" : "…")}
          </p>
        </div>
      </div>
    </div>
  );
}
