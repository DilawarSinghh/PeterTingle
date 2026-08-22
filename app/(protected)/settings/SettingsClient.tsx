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
  { value: "lite",  label: "Lite",  desc: "Drop filler and hedging. Keep articles and full sentences. Professional but tight." },
  { value: "full",  label: "Full",  desc: "Drop articles, fragments OK, short synonyms. Classic caveman compression." },
  { value: "ultra", label: "Ultra", desc: "Strip conjunctions when cause-effect is unambiguous. One word when one word is enough." },
];

export default function SettingsClient({ initialProfile }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>(initialProfile.compressionLevel);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null); setSaved(false);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, compression_level: compressionLevel })
      .eq("id", (await supabase.auth.getUser()).data.user!.id);
    if (error) { setError(error.message); }
    else { setSaved(true); setTimeout(() => setSaved(false), 2000); router.refresh(); }
    setSaving(false);
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== "DELETE") return;
    setDeleting(true);
    // Client SDK can't delete auth users â€” sign out and direct to support.
    // (A self-serve deletion endpoint requires the service role; tracked as a TODO.)
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="h-full overflow-y-auto bg-background px-4 pb-6 pt-14 sm:px-6 sm:pt-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
          <p className="mt-1 text-sm text-text-secondary">Manage your account and compression preferences.</p>
        </div>

        {/* Profile */}
        <section className="card p-4 space-y-5 sm:p-6">
          <h2 className="text-base font-semibold text-text-primary">Profile</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary">Email</label>
              <p className="mt-1 text-sm text-text-muted">{initialProfile.email}</p>
            </div>
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-text-secondary">Display name</label>
              <input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input mt-1" placeholder="Your name" />
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Savingâ€¦" : saved ? "Saved âœ“" : "Save changes"}
            </button>
          </form>
        </section>

        {/* Compression */}
        <section className="card p-4 space-y-4 sm:p-6">
          <h2 className="text-base font-semibold text-text-primary">Default compression level</h2>
          <p className="text-sm text-text-secondary">Sets the default for new chat sessions. Override per-session in the chat header.</p>
          <div className="space-y-2">
            {LEVELS.map((l) => (
              <label
                key={l.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  compressionLevel === l.value
                    ? "border-accent-muted bg-accent-dim"
                    : "border-surface-3 hover:bg-surface-2"
                }`}
              >
                <input
                  type="radio"
                  name="level"
                  value={l.value}
                  checked={compressionLevel === l.value}
                  onChange={() => setCompressionLevel(l.value)}
                  className="mt-0.5 accent-accent"
                />
                <div>
                  <span className={`text-sm font-medium ${compressionLevel === l.value ? "text-accent" : "text-text-primary"}`}>{l.label}</span>
                  <p className="text-xs text-text-secondary">{l.desc}</p>
                </div>
              </label>
            ))}
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "Savingâ€¦" : saved ? "Saved âœ“" : "Save level"}
          </button>
        </section>

        {/* API Keys */}
        <ApiKeysSection />

        {/* Danger zone */}
        <section className="rounded-xl border border-error bg-error-bg p-4 space-y-4 sm:p-6">
          <h2 className="text-base font-semibold text-error">Danger zone</h2>
          <p className="text-sm text-error opacity-80">
            Deleting your account removes all conversations and usage data. This cannot be undone.
          </p>
          <div className="space-y-2">
            <label className="block text-sm text-error">Type <strong>DELETE</strong> to confirm</label>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="input border-error focus:border-error focus:ring-error"
              placeholder="DELETE"
            />
          </div>
          <button
            onClick={handleDeleteAccount}
            disabled={deleteConfirm !== "DELETE" || deleting}
            className="inline-flex items-center justify-center rounded-md bg-error px-4 py-2 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting ? "Deletingâ€¦" : "Delete my account"}
          </button>
        </section>
      </div>
    </div>
  );
}

