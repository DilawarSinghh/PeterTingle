"use client";

import { useState, useRef, useEffect } from "react";
import type { Model } from "@/types/database";

interface Props {
  models: Model[];
  selectedId: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai:     "OpenAI",
  anthropic:  "Anthropic",
  groq:       "Groq",
  nvidia:     "NVIDIA NIM",
  openrouter: "OpenRouter",
};

export default function ModelSelector({ models, selectedId, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = models.find((m) => m.id === selectedId) ?? models[0];

  const groups = models.reduce<Record<string, Model[]>>((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = [];
    acc[m.provider].push(m);
    return acc;
  }, {});

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!models.length) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-md border border-surface-3 bg-surface px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-sm hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <span className="truncate max-w-[130px]">{selected?.display_name ?? "Select model"}</span>
        <svg
          className={`w-3 h-3 text-text-secondary transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-60 rounded-xl border border-surface-3 bg-surface shadow-lg overflow-hidden">
          {Object.entries(groups).map(([provider, providerModels]) => (
            <div key={provider}>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted bg-surface-2 border-b border-surface-3">
                {PROVIDER_LABELS[provider] ?? provider}
              </div>
              {providerModels.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { onChange(m.id); setOpen(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-surface-2 transition-colors ${
                    m.id === selectedId
                      ? "text-accent font-medium bg-accent-dim"
                      : "text-text-primary"
                  }`}
                >
                  <span>{m.display_name}</span>
                  {m.input_cost_per_1k != null && (
                    <span className="text-[10px] text-text-secondary">
                      ${(m.input_cost_per_1k * 1000).toFixed(3)}/1M
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
