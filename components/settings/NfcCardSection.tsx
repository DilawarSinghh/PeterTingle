"use client";

import { useState, useEffect } from "react";
import { isNFCSupported, scanNFCTag } from "@/lib/nfc";

interface NfcCard {
  id: string;
  nfc_tag_id: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
}

export default function NfcCardSection() {
  const [supported, setSupported] = useState(false);
  const [cards, setCards] = useState<NfcCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [label, setLabel] = useState("");

  useEffect(() => {
    setSupported(isNFCSupported());
    fetch("/api/nfc/bind")
      .then((r) => r.json())
      .then((d) => setCards(d.cards ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleBindCard() {
    setScanning(true);
    setMessage(null);
    try {
      const tagId = await scanNFCTag();
      const res = await fetch("/api/nfc/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nfc_tag_id: tagId, label }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ kind: "ok", text: data.alreadyBound ? "Card was already linked to your account." : "Card linked. You can now tap it on the login page to sign in." });
        setLabel("");
        const refreshed = await fetch("/api/nfc/bind").then((r) => r.json()).catch(() => ({}));
        setCards(refreshed.cards ?? []);
      } else {
        setMessage({ kind: "err", text: data.error ?? "Failed to link card." });
      }
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Scan failed." });
    } finally {
      setScanning(false);
    }
  }

  async function handleUnbind(tag: string) {
    if (!confirm("Unlink this card? You will no longer be able to sign in with it.")) return;
    const res = await fetch(`/api/nfc/bind?tag=${encodeURIComponent(tag)}`, { method: "DELETE" });
    if (res.ok) setCards((prev) => prev.filter((c) => c.nfc_tag_id !== tag));
  }

  function maskTag(tag: string): string {
    if (tag.length <= 8) return tag;
    return tag.slice(0, 4) + "\u2022".repeat(6) + tag.slice(-4);
  }

  return (
    <section className="card p-4 space-y-4 sm:p-6">
      <div>
        <h2 className="text-base font-semibold text-text-primary">NFC sign-in cards</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Link an NFC card to your account, then tap it on the login page to sign in instantly.
        </p>
      </div>

      {!supported && (
        <p className="rounded-lg border border-surface-3 bg-surface-2 px-4 py-3 text-xs text-text-secondary">
          NFC is not supported on this device or browser. Card binding works on Android Chrome —
          open Settings there to link a card.
        </p>
      )}

      {loading ? (
        <p className="text-xs text-text-muted">Loading cards…</p>
      ) : (
        <div className="space-y-2">
          {cards.length === 0 && <p className="text-xs text-text-muted">No cards linked yet.</p>}
          {cards.map((card) => (
            <div key={card.id} className="flex items-center justify-between gap-3 rounded-lg border border-surface-3 bg-surface-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-text-primary">{card.label || "NFC card"}</p>
                <p className="truncate font-mono text-[11px] text-text-muted">
                  {maskTag(card.nfc_tag_id)}
                  {card.last_used_at ? ` · used ${new Date(card.last_used_at).toLocaleDateString()}` : " · never used"}
                </p>
              </div>
              <button
                onClick={() => handleUnbind(card.nfc_tag_id)}
                className="shrink-0 text-xs text-error underline hover:opacity-80"
              >
                Unlink
              </button>
            </div>
          ))}
        </div>
      )}

      {supported && (
        <div className="space-y-3">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Card name (optional — e.g. Work badge)"
            className="input text-sm"
            maxLength={60}
          />
          <button onClick={handleBindCard} disabled={scanning} className="btn-secondary w-full">
            {scanning ? (
              <>
                <span className="logo-spinner text-base leading-none text-accent">⛏</span>
                Hold card against the back of your phone…
              </>
            ) : (
              "Link a card"
            )}
          </button>
        </div>
      )}

      {message && (
        <p className={`text-xs font-medium ${message.kind === "ok" ? "text-success" : "text-error"}`}>
          {message.kind === "ok" ? "✓ " : "✗ "}{message.text}
        </p>
      )}
    </section>
  );
}

