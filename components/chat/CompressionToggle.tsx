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
  { value: "lite", label: "Lite", desc: "Drop filler/hedging. Keep articles." },
  { value: "full", label: "Full", desc: "Drop articles. Fragments OK." },
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
    <div className="flex items-center gap-3">
      {/* Level selector (only visible when enabled) */}
      {enabled && (
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              onClick={() => onLevelChange(l.value)}
              title={l.desc}
              disabled={disabled}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                level === l.value
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
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
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          enabled
            ? "border-brand-200 bg-brand-50 text-brand-700"
            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
        }`}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            enabled ? "bg-brand-500" : "bg-gray-400"
          }`}
        />
        {enabled ? "Compression on" : "Compression off"}
      </button>
    </div>
  );
}
