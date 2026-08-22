"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useChat } from "@/components/providers/ChatProvider";
import type { Conversation } from "@/types/database";

interface Props {
  user: { email: string; displayName: string };
}

const NAV = [
  { href: "/chat",      label: "Chat",      icon: "💬" },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/settings",  label: "Settings",  icon: "⚙️" },
];

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
}

export default function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { conversationId, loadConversation, startNewChat, refreshTrigger, sidebarOpen, setSidebarOpen } = useChat();

  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setConvs(d.conversations ?? []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) { renameInputRef.current.focus(); renameInputRef.current.select(); }
  }, [renamingId]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function commitRename(id: string) {
    const title = renameValue.trim();
    if (!title) { setRenamingId(null); return; }
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }),
    });
    if (res.ok) setConvs((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    setRenamingId(null);
  }

  async function confirmDelete(id: string, title: string | null) {
    if (!confirm(`Delete "${title || "this chat"}"?`)) return;
    const res = await fetch(`/api/conversations?id=${id}`, { method: "DELETE" });
    if (res.ok) { setConvs((prev) => prev.filter((c) => c.id !== id)); if (conversationId === id) startNewChat(); }
  }

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={"fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-surface-3 bg-surface text-sm transition-transform duration-200 sm:relative " + (sidebarOpen ? "translate-x-0" : "-translate-x-full sm:hidden")}>
        {/* Logo + New chat */}
        <div className="flex items-center gap-2 border-b border-surface-3 px-3 py-3">
          <span className="text-xl text-accent">⛏</span>
          <span className="font-bold text-text-primary">TokenSaver</span>
        </div>

        <div className="px-2 py-2">
          <button
            onClick={startNewChat}
            className="flex w-full items-center gap-2 rounded-lg border border-surface-3 bg-surface-2 px-3 py-2 text-text-primary transition-colors hover:border-accent-muted hover:bg-accent-dim hover:text-accent"
          >
            <span className="text-base leading-none">+</span>
            New chat
          </button>
        </div>

        {/* Nav */}
        <nav className="px-2 pb-2">
          {NAV.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={"flex items-center gap-3 rounded-lg px-3 py-2 font-medium transition-colors " + (
                pathname.startsWith(href)
                  ? "bg-accent-dim text-accent"
                  : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
              )}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        {/* History */}
        <div className="flex min-h-0 flex-1 flex-col border-t border-surface-3 px-2 pt-2">
          <span className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">History</span>
          <div className="flex-1 overflow-y-auto overscroll-contain space-y-0.5">
            {loading && <div className="px-3 py-2 text-xs text-text-muted">Loading…</div>}
            {!loading && convs.length === 0 && (
              <div className="px-3 py-4 text-xs text-text-muted">No conversations yet</div>
            )}
            {convs.map((conv) => (
              <div
                key={conv.id}
                onClick={() => renamingId !== conv.id && loadConversation(conv)}
                className={"group relative cursor-pointer rounded-lg px-3 py-2 transition-colors " + (
                  conv.id === conversationId
                    ? "bg-accent-dim text-accent"
                    : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                )}
              >
                {renamingId === conv.id ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(conv.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitRename(conv.id); if (e.key === "Escape") setRenamingId(null); }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full rounded border border-accent bg-surface-2 px-1.5 py-0.5 text-xs text-text-primary outline-none"
                  />
                ) : (
                  <div className="flex items-center justify-between gap-2 pr-6">
                    <span className="truncate text-xs">{conv.title || "New chat"}</span>
                    <span className="shrink-0 text-[10px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                      {relativeTime(conv.updated_at)}
                    </span>
                  </div>
                )}

                {renamingId !== conv.id && (
                  <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 group-hover:flex" onClick={(e) => e.stopPropagation()}>
                    <button
                      title="Rename"
                      onClick={() => { setRenamingId(conv.id); setRenameValue(conv.title ?? ""); }}
                      className="rounded p-1 text-text-muted hover:text-accent"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 0110 16.414H8v-2a2 2 0 01.586-1.414z" /></svg>
                    </button>
                    <button
                      title="Delete"
                      onClick={() => confirmDelete(conv.id, conv.title)}
                      className="rounded p-1 text-text-muted hover:text-error"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V4a1 1 0 011-1h6a1 1 0 011 1v3" /></svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* User */}
        <div className="border-t border-surface-3 px-3 py-3">
          <div className="mb-2 truncate">
            <p className="truncate text-xs font-medium text-text-primary">{user.displayName}</p>
            <p className="truncate text-xs text-text-secondary">{user.email}</p>
          </div>
          <button onClick={handleSignOut} className="btn-ghost w-full justify-start text-xs">Sign out</button>
        </div>
      </aside>
    </>
  );
}
