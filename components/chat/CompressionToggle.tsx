"use client";

import type { CompressionLevel } from "@/types/database";

interface Props {
  enabled: boolean;
  level: CompressionLevel;
  onToggle: (enabled: boolean) => void;
  onLevelChange: (level: CompressionLevel) => void;
  disabled?: boolean;
}

const LEVELS: { value: CompressionLevel; label: string; desc: string }[] = [
  { value: "lite",  label: "Lite",  desc: "Drop filler/hedging. Keep articles." },
  { value: "full",  label: "Full",  desc: "Drop articles. Fragments OK." },
  { value: "ultra", label: "Ultra", desc: "Max compression. One word when enough." },
];

export default function CompressionToggle({
  enabled,
  level,
  onToggle,
  onLevelChange,
  disabled = false,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      {/* Level selector */}
      {enabled && (
        <div className="flex items-center gap-0.5 rounded-md border border-surface-3 bg-surface p-0.5">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              onClick={() => onLevelChange(l.value)}
              title={l.desc}
              disabled={disabled}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                level === l.value
                  ? "bg-accent text-background shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      {/* Toggle */}
      <button
        onClick={() => onToggle(!enabled)}
        disabled={disabled}
        className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          enabled
            ? "border-accent-muted bg-accent-dim text-accent"
            : "border-surface-3 bg-surface text-text-secondary hover:bg-surface-2"
        }`}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            enabled ? "bg-accent" : "bg-text-muted"
          }`}
        />
        {enabled ? "Compression on" : "Compression off"}
      </button>
    </div>
  );
}
