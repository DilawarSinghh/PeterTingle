"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { Model } from "@/types/database";

interface Props {
  models: Model[];
  selectedId: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  /** Providers the user has saved their own API key for - shown in a dedicated top group. */
  userKeyProviders?: string[];
}

const PROVIDER_LABELS: Record<string, string> = {
  openai:     "OpenAI",
  anthropic:  "Anthropic",
  groq:       "Groq",
  nvidia:     "NVIDIA NIM",
  openrouter: "OpenRouter",
};

const PROVIDER_ORDER = ["openai", "anthropic", "groq", "nvidia", "openrouter"];

export default function ModelSelector({ models, selectedId, onChange, disabled, userKeyProviders = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = models.find((m) => m.id === selectedId) ?? models[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? models.filter(
          (m) =>
            m.display_name.toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q) ||
            m.provider.toLowerCase().includes(q)
        )
      : models;

    const byokSet = new Set(userKeyProviders);
    const byokModels = filtered.filter((m) => byokSet.has(m.provider));
    const rest = filtered.filter((m) => !byokSet.has(m.provider));

    const byProvider = rest.reduce<Record<string, Model[]>>((acc, m) => {
      (acc[m.provider] ??= []).push(m);
      return acc;
    }, {});

    const providerGroups = Object.entries(byProvider).sort(
      ([a], [b]) =>
        (PROVIDER_ORDER.indexOf(a) === -1 ? 99 : PROVIDER_ORDER.indexOf(a)) -
        (PROVIDER_ORDER.indexOf(b) === -1 ? 99 : PROVIDER_ORDER.indexOf(b))
    );

    return byokModels.length > 0
      ? ([['__byok__', byokModels], ...providerGroups] as [string, Model[]][])
      : providerGroups;
  }, [models, query, userKeyProviders]);

  if (!models.length) {
    return (
      <button
        disabled
        title="No active models found in the database — run the model sync script"
        className="flex items-center gap-2 rounded-lg border border-surface-3 bg-surface px-3 py-1.5 text-xs font-medium text-text-muted opacity-60 cursor-not-allowed"
      >
        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted" />
        No models available
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        title={selected ? selected.display_name + " / " + (PROVIDER_LABELS[selected.provider] ?? selected.provider) : "Select model"}
        className="flex items-center gap-2 rounded-lg border border-surface-3 bg-surface px-3 py-1.5 text-xs font-medium text-text-primary shadow-sm hover:border-accent-muted hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
        <span className="truncate max-w-[100px] sm:max-w-[150px]">{selected?.display_name ?? "Select model"}</span>
        <svg
          className={"w-3 h-3 shrink-0 text-text-secondary transition-transform " + (open ? "rotate-180" : "")}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 flex w-72 flex-col overflow-hidden rounded-xl border border-surface-3 bg-surface shadow-lg animate-fade-in">
          <div className="border-b border-surface-3 p-2">
            <div className="flex items-center gap-2 rounded-md bg-surface-2 px-2.5 py-1.5">
              <svg className="w-3.5 h-3.5 shrink-0 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
              </svg>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search models…"
                className="w-full bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-text-muted hover:text-text-primary text-xs">✕</button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto overscroll-contain">
            {groups.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-text-muted">No models match that search</p>
            )}
            {groups.map(([provider, providerModels]) => (
              <div key={provider}>
                <div className="sticky top-0 border-b border-surface-3 bg-surface-2/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted backdrop-blur">
                  {provider === "__byok__" ? (
                    <span className="text-accent">🔑 Your API keys</span>
                  ) : (
                    PROVIDER_LABELS[provider] ?? provider
                  )}
                  <span className="ml-1.5 font-normal normal-case">({providerModels.length})</span>
                </div>
                {providerModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { onChange(m.id); setOpen(false); }}
                    className={"flex w-full items-center justify-between gap-2 px-3 py-2 text-xs transition-colors " + (m.id === selectedId ? "bg-accent-dim font-medium text-accent" : "text-text-primary hover:bg-surface-2")}
                  >
                    <span className="truncate text-left">{m.display_name}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {m.input_cost_per_1k != null && (
                        <span className="text-[10px] text-text-secondary">
                          ${(m.input_cost_per_1k * 1000).toFixed(3)}/1M
                        </span>
                      )}
                      {m.id === selectedId && (
                        <svg className="w-3 h-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
