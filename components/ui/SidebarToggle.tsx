"use client";

import { useChat } from "@/components/providers/ChatProvider";

/**
 * Floating logo button that re-opens the sidebar when it is hidden.
 * - Desktop: only visible while the sidebar is collapsed (sidebar lives in normal flow).
 * - Mobile: always visible (sidebar renders as an overlay).
 */
export default function SidebarToggle() {
  const { sidebarOpen, toggleSidebar } = useChat();

  return (
    <button
      onClick={toggleSidebar}
      title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
      aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
      className={
        "fixed left-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-lg border border-surface-3 bg-surface text-accent shadow-sm transition-all hover:bg-surface-2 " +
        (sidebarOpen ? "sm:hidden" : "")
      }
    >
      <span className="text-lg leading-none">⛏</span>
    </button>
  );
}
