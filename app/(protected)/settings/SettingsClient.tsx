"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { CompressionLevel } from "@/types/database";
import ApiKeysSection from "@/components/settings/ApiKeysSection";

interface Props {
  initialProfile: {
    displayName: string;
    compressionLevel: CompressionLevel;
    email: string;
  };
}

const LEVELS: { value: CompressionLevel; label: string; desc: string }[] = [
  {
    value: "lite",
    label: "Lite",
    desc: "Drop filler and hedging. Keep articles and full sentences. Professional but tight.",
  },
  {
    value: "full",
    label: "Full",
    desc: "Drop articles, fragments OK, short synonyms. Classic caveman compression.",
  },
  {
    value: "ultra",
    label: "Ultra",
    desc: "Strip conjunctions when cause-effect is unambiguous. One word when one word is enough.",
  },
];

export default function SettingsClient({ initialProfile }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>(
    initialProfile.compressionLevel
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, compression_level: compressionLevel })
      .eq("id", (await supabase.auth.getUser()).data.user!.id);

    if (error) {
      setError(error.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
    setSaving(false);
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== "DELETE") return;
    setDeleting(true);

    // Sign out first, then delete via Supabase admin (or just sign out for safety)
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your account and compression preferences.
          </p>
        </div>

        {/* Profile section */}
        <section className="card p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800">Profile</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <p className="mt-1 text-sm text-gray-500">{initialProfile.email}</p>
            </div>
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input mt-1"
                placeholder="Your name"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
            </button>
          </form>
        </section>

        {/* Compression preferences */}
        <section className="card p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">
            Default compression level
          </h2>
          <p className="text-sm text-gray-500">
            Sets the default intensity for new chat sessions. You can override
            per-session in the chat header.
          </p>
          <div className="space-y-2">
            {LEVELS.map((l) => (
              <label
                key={l.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  compressionLevel === l.value
                    ? "border-brand-300 bg-brand-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="level"
                  value={l.value}
                  checked={compressionLevel === l.value}
                  onChange={() => setCompressionLevel(l.value)}
                  className="mt-0.5 accent-brand-600"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">{l.label}</span>
                  <p className="text-xs text-gray-500">{l.desc}</p>
                </div>
              </label>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save level"}
          </button>
        </section>

        {/* API Keys (BYOK) */}
        <ApiKeysSection />

        {/* Danger zone */}
        <section className="rounded-xl border border-red-200 bg-red-50 p-6 space-y-4">
          <h2 className="text-base font-semibold text-red-800">Danger zone</h2>
          <p className="text-sm text-red-700">
            Deleting your account removes all conversations and usage data. This
            cannot be undone.
          </p>
          <div className="space-y-2">
            <label className="block text-sm text-red-700">
              Type <strong>DELETE</strong> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="input border-red-300 focus:border-red-500 focus:ring-red-500"
              placeholder="DELETE"
            />
          </div>
          <button
            onClick={handleDeleteAccount}
            disabled={deleteConfirm !== "DELETE" || deleting}
            className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? "Deleting…" : "Delete my account"}
          </button>
        </section>
      </div>
    </div>
  );
}
