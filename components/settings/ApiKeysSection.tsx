"use client";

import { useState, useEffect } from "react";

interface KeyStatus {
  provider: string;
  last_verified_at: string | null;
}

const PROVIDERS = [
  { id: "openai",     label: "OpenAI",     placeholder: "sk-..." },
  { id: "anthropic",  label: "Anthropic",  placeholder: "sk-ant-..." },
  { id: "groq",       label: "Groq",       placeholder: "gsk_..." },
  { id: "openrouter", label: "OpenRouter", placeholder: "sk-or-..." },
];

export default function ApiKeysSection() {
  const [keyStatuses, setKeyStatuses] = useState<KeyStatus[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [removing, setRemoving] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { valid: boolean; error?: string } | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/keys")
      .then((r) => r.json())
      .then((d) => setKeyStatuses(d.keys ?? []));
  }, []);

  function getStatus(provider: string): KeyStatus | null {
    return keyStatuses.find((k) => k.provider === provider) ?? null;
  }

  async function handleSave(provider: string) {
    const key = inputValues[provider]?.trim();
    if (!key) return;
    setSaving((p) => ({ ...p, [provider]: true }));
    setErrors((p) => ({ ...p, [provider]: "" }));
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey: key }),
    });
    if (res.ok) {
      setKeyStatuses((prev) => {
        const existing = prev.find((k) => k.provider === provider);
        if (existing) return prev.map((k) => k.provider === provider ? { ...k, last_verified_at: null } : k);
        return [...prev, { provider, last_verified_at: null }];
      });
      setInputValues((p) => ({ ...p, [provider]: "" }));
      setTestResults((p) => ({ ...p, [provider]: null }));
    } else {
      const data = await res.json().catch(() => ({}));
      setErrors((p) => ({ ...p, [provider]: data.error ?? "Save failed" }));
    }
    setSaving((p) => ({ ...p, [provider]: false }));
  }

  async function handleTest(provider: string) {
    const key = inputValues[provider]?.trim();
    if (!key) return;
    setTesting((p) => ({ ...p, [provider]: true }));
    setTestResults((p) => ({ ...p, [provider]: null }));
    const res = await fetch("/api/keys/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey: key }),
    });
    const data = await res.json().catch(() => ({ valid: false, error: "Unknown error" }));
    setTestResults((p) => ({ ...p, [provider]: data }));
    setTesting((p) => ({ ...p, [provider]: false }));
  }

  async function handleRemove(provider: string) {
    setRemoving((p) => ({ ...p, [provider]: true }));
    const res = await fetch(`/api/keys?provider=${provider}`, { method: "DELETE" });
    if (res.ok) {
      setKeyStatuses((prev) => prev.filter((k) => k.provider !== provider));
      setTestResults((p) => ({ ...p, [provider]: null }));
    }
    setRemoving((p) => ({ ...p, [provider]: false }));
  }

  return (
    <section className="card p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-text-primary">API Keys (BYOK)</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Keys are encrypted at rest and used <strong className="text-text-primary">only</strong> when
          platform quota for a provider is reached. You&apos;ll see a{" "}
          <span className="text-warning font-medium">🔑 via your API key</span> label in chat when this happens.
        </p>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map(({ id, label, placeholder }) => {
          const status = getStatus(id);
          const hasKey = !!status;
          const isVerified = !!status?.last_verified_at;
          const testResult = testResults[id];

          return (
            <div key={id} className="rounded-lg border border-surface-3 bg-surface-2 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">{label}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  !hasKey
                    ? "bg-surface-3 text-text-muted"
                    : isVerified
                    ? "bg-success-bg text-success"
                    : "bg-warning-bg text-warning"
                }`}>
                  {!hasKey ? "Not set" : isVerified ? "Verified ✓" : "Saved (unverified)"}
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={inputValues[id] ?? ""}
                  onChange={(e) => setInputValues((p) => ({ ...p, [id]: e.target.value }))}
                  placeholder={hasKey ? "Enter new key to replace…" : placeholder}
                  className="input flex-1 font-mono text-xs"
                  autoComplete="off"
                />
                <button onClick={() => handleTest(id)} disabled={!inputValues[id]?.trim() || testing[id]} className="btn-secondary px-3 text-xs whitespace-nowrap">
                  {testing[id] ? "Testing…" : "Test key"}
                </button>
                <button onClick={() => handleSave(id)} disabled={!inputValues[id]?.trim() || saving[id]} className="btn-primary px-3 text-xs">
                  {saving[id] ? "Saving…" : "Save"}
                </button>
              </div>

              {errors[id] && <p className="text-xs text-error">{errors[id]}</p>}
              {testResult && (
                <p className={`text-xs font-medium ${testResult.valid ? "text-success" : "text-error"}`}>
                  {testResult.valid ? "✓ Key is valid and working" : `✗ Invalid — ${testResult.error ?? "check your key"}`}
                </p>
              )}
              {hasKey && (
                <button onClick={() => handleRemove(id)} disabled={removing[id]} className="text-xs text-error hover:opacity-80 underline disabled:opacity-40">
                  {removing[id] ? "Removing…" : "Remove saved key"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
