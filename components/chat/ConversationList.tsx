"use client";

import { useState, useEffect, useRef } from "react";
import type { Conversation } from "@/types/database";

interface Props {
  activeId: string | null;
  onSelect: (conv: Conversation) => void;
  onNew: () => void;
  onDeleted: (id: string) => void;
  onRenamed: (id: string, title: string) => void;
  refreshTrigger: number;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ConversationList({
  activeId, onSelect, onNew, onDeleted, onRenamed, refreshTrigger,
}: Props) {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) { setConvs(d.conversations ?? []); setLoading(false); }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  async function commitRename(id: string) {
    const title = renameValue.trim();
    if (!title) { setRenamingId(null); return; }
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      setConvs((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
      onRenamed(id, title);
    }
    setRenamingId(null);
  }

  async function confirmDelete(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/conversations?id=${id}`, { method: "DELETE" });
    if (res.ok) { setConvs((prev) => prev.filter((c) => c.id !== id)); onDeleted(id); }
    setDeletingId(null);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* New chat */}
      <div className="px-2 pb-2 pt-1">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 rounded-md border border-dashed border-accent-muted bg-accent-dim px-3 py-2 text-xs font-medium text-accent hover:bg-accent-muted transition-colors"
        >
          <span className="text-base leading-none">+</span>
          New chat
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {loading && (
          <div className="py-4 text-center text-xs text-text-muted">Loading…</div>
        )}
        {!loading && convs.length === 0 && (
          <div className="py-6 text-center text-xs text-text-muted">No conversations yet</div>
        )}
        {convs.map((conv) => (
          <div
            key={conv.id}
            className={`group relative flex items-center rounded-md px-2 py-2 cursor-pointer transition-colors ${
              conv.id === activeId
                ? "bg-accent-dim text-accent"
                : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            }`}
            onMouseEnter={() => setHoverId(conv.id)}
            onMouseLeave={() => setHoverId(null)}
            onClick={() => renamingId !== conv.id && onSelect(conv)}
          >
            {renamingId === conv.id ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => commitRename(conv.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(conv.id);
                  if (e.key === "Escape") setRenamingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 rounded border border-accent bg-surface-2 px-1.5 py-0.5 text-xs text-text-primary outline-none focus:ring-1 focus:ring-accent"
              />
            ) : (
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium leading-snug">
                  {conv.title || "New chat"}
                </p>
                <p className="text-[10px] text-text-muted leading-tight mt-0.5">
                  {relativeTime(conv.updated_at)}
                </p>
              </div>
            )}

            {hoverId === conv.id && renamingId !== conv.id && (
              <div className="flex items-center gap-0.5 ml-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  title="Rename"
                  onClick={() => { setRenamingId(conv.id); setRenameValue(conv.title ?? ""); }}
                  className="rounded p-1 text-text-muted hover:text-accent hover:bg-accent-dim transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 0110 16.414H8v-2a2 2 0 01.586-1.414z" />
                  </svg>
                </button>
                <button
                  title="Delete"
                  disabled={deletingId === conv.id}
                  onClick={() => { if (confirm(`Delete "${conv.title || "this chat"}"?`)) confirmDelete(conv.id); }}
                  className="rounded p-1 text-text-muted hover:text-error hover:bg-error-bg transition-colors disabled:opacity-40"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V4a1 1 0 011-1h6a1 1 0 011 1v3" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
