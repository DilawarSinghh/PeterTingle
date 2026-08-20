"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  user: { email: string; displayName: string };
}

const NAV = [
  { href: "/chat",      label: "Chat",      icon: "💬" },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/settings",  label: "Settings",  icon: "⚙️" },
];

export default function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-56 flex-col border-r border-surface-3 bg-surface">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-surface-3 px-4 py-4">
        <span className="text-xl text-accent">⛏</span>
        <span className="font-bold text-text-primary">TokenSaver</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2 py-4">
        {NAV.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              pathname.startsWith(href)
                ? "bg-accent-dim text-accent"
                : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            }`}
          >
            <span className="text-base">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-surface-3 px-3 py-3">
        <div className="mb-2 truncate px-1">
          <p className="truncate text-xs font-medium text-text-primary">{user.displayName}</p>
          <p className="truncate text-xs text-text-secondary">{user.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="btn-ghost w-full justify-start text-xs"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
