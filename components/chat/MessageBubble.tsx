"use client";

import type { ChatMessage } from "./ChatInterface";

interface Props {
  message: ChatMessage;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={"flex items-end gap-2 " + (isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div
          className={"mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs " + (
            message.error
              ? "border-error/50 bg-error-bg text-error"
              : "border-accent-muted bg-accent-dim text-accent"
          )}
        >
          ⛏
        </div>
      )}
      <div
        className={"max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm " + (
          isUser
            ? "rounded-br-md bg-accent-muted/60 text-text-primary border border-accent-muted"
            : message.error
              ? "rounded-bl-md bg-error-bg text-error border border-error/40"
              : "rounded-bl-md bg-surface text-text-primary border border-surface-3"
        )}
      >
        {isUser && message.originalContent && message.content !== message.originalContent && (
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-accent opacity-80">
            ✂ Input compressed
          </p>
        )}

        <p
          className={"whitespace-pre-wrap break-words " + (message.streaming ? "streaming-cursor" : "")}
        >
          {message.content || (message.streaming ? "" : "…")}
        </p>
      </div>
    </div>
  );
}
