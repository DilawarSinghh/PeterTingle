"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  user: { email: string; displayName: string };
}

const NAV = [
  { href: "/chat", label: "Chat", icon: "💬" },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
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
    <aside className="flex h-full w-56 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-4">
        <span className="text-xl">⛏</span>
        <span className="font-bold text-brand-700">TokenSaver</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {NAV.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              pathname.startsWith(href)
                ? "bg-brand-50 text-brand-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <span className="text-base">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-gray-200 px-3 py-3">
        <div className="mb-2 truncate px-1">
          <p className="truncate text-xs font-medium text-gray-900">{user.displayName}</p>
          <p className="truncate text-xs text-gray-500">{user.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="btn-ghost w-full justify-start text-xs text-gray-500"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
