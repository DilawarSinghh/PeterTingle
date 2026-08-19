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
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-brand-600 text-white"
            : "bg-white text-gray-900 shadow-sm border border-gray-100"
        }`}
      >
        {/* Show original vs compressed diff hint for user messages */}
        {isUser &&
          message.originalContent &&
          message.content !== message.originalContent && (
            <p className="mb-1.5 text-xs text-brand-200">
              ✂ Input compressed
            </p>
          )}

        <p
          className={`whitespace-pre-wrap break-words ${
            message.streaming ? "streaming-cursor" : ""
          }`}
        >
          {message.content || (message.streaming ? "" : "…")}
        </p>
      </div>
    </div>
  );
}
