import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

async function getAggregateSavings() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("usage_logs").select("tokens_saved");
    return (data ?? []).reduce((sum, r) => sum + (r.tokens_saved ?? 0), 0);
  } catch { return 0; }
}

export default async function LandingPage() {
  const totalTokensSaved = await getAggregateSavings();

  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-surface-3 px-6 py-4">
        <span className="text-xl font-bold text-accent">⛏ TokenSaver</span>
        <div className="flex items-center gap-3">
          <Link href="/login" className="btn-ghost text-sm">Sign in</Link>
          <Link href="/signup" className="btn-primary text-sm">Get started free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent-muted bg-accent-dim px-4 py-1.5 text-sm font-medium text-accent">
          ⛏ why use many token when few do trick
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-text-primary">
          Chat with AI.{" "}
          <span className="text-accent">Spend less.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-text-secondary">
          TokenSaver compresses both sides of every conversation — stripping filler from your
          prompts before they go out, and instructing the AI to reply terse without losing
          technical accuracy.
        </p>

        {totalTokensSaved > 0 && (
          <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-success-bg px-5 py-2 text-sm font-medium text-success">
            <span className="text-lg">📊</span>
            <span>
              <strong>{totalTokensSaved.toLocaleString()}</strong> tokens saved across all users
            </span>
            <span className="text-xs text-text-secondary italic">inferred</span>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">
            Start saving tokens →
          </Link>
          <Link href="/login" className="btn-ghost text-sm">Already have an account</Link>
        </div>
      </section>

      {/* Before / after */}
      <section className="border-y border-surface-3 bg-surface py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold text-text-primary">See it in action</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Normal AI — 69 tokens
              </p>
              <p className="text-sm text-text-secondary leading-relaxed">
                "The reason your React component is re-rendering is likely because you're creating
                a new object reference on each render cycle. When you pass an inline object as a
                prop, React's shallow comparison sees it as a different object every time, which
                triggers a re-render. I'd recommend using useMemo to memoize the object."
              </p>
            </div>
            <div className="rounded-xl border border-accent-muted bg-accent-dim p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">
                TokenSaver — 19 tokens · <span className="text-success">−72%</span>
              </p>
              <p className="text-sm text-text-primary leading-relaxed font-medium">
                "New object ref each render. Inline object prop = new ref = re-render.
                Wrap in <code className="font-mono text-accent">useMemo</code>."
              </p>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-text-muted italic">
            Same fix, fewer words. Token counts are inferred estimates.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-10 text-center text-2xl font-bold text-text-primary">How it works</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                icon: "✂",
                title: "Input compression",
                desc: "Filler phrases, redundant politeness, and whitespace noise are stripped from your message before it reaches the model.",
              },
              {
                icon: "📝",
                title: "Output instruction",
                desc: "A system prompt tells the AI to reply terse while keeping full technical accuracy.",
              },
              {
                icon: "📊",
                title: "Live savings",
                desc: "Per-message and cumulative token counts show exactly what was saved. All estimates labeled 'inferred'.",
              },
            ].map((item) => (
              <div key={item.title} className="card p-5">
                <div className="mb-3 text-2xl text-accent">{item.icon}</div>
                <h3 className="mb-1 text-sm font-semibold text-text-primary">{item.title}</h3>
                <p className="text-sm text-text-secondary">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compression levels */}
      <section className="border-y border-surface-3 bg-surface py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold text-text-primary">
            Three compression levels
          </h2>
          <div className="space-y-3">
            {[
              {
                level: "Lite",
                badgeCls: "bg-accent-dim text-accent border border-accent-muted",
                desc: "Drop filler and hedging. Keep articles and full sentences. Professional but tight.",
                example: "Your component re-renders because you create a new object reference each render. Wrap it in useMemo.",
              },
              {
                level: "Full",
                badgeCls: "bg-accent text-background",
                desc: "Drop articles. Fragments OK. Short synonyms. Classic caveman compression. (default)",
                example: "New object ref each render. Inline object prop = new ref = re-render. Wrap in useMemo.",
              },
              {
                level: "Ultra",
                badgeCls: "bg-accent-muted text-success border border-accent",
                desc: "Strip conjunctions when cause-effect is unambiguous. One word when one word is enough.",
                example: "Inline obj prop, new ref, re-render. useMemo.",
              },
            ].map((l) => (
              <div key={l.level} className="card p-4">
                <div className="flex items-start gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 ${l.badgeCls}`}>
                    {l.level}
                  </span>
                  <div>
                    <p className="text-xs text-text-secondary">{l.desc}</p>
                    <p className="mt-1 text-sm italic text-text-primary">"{l.example}"</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center">
        <h2 className="text-2xl font-bold text-text-primary">Start saving tokens for free</h2>
        <p className="mt-3 text-sm text-text-secondary">
          No credit card. Works with OpenRouter, Groq, NVIDIA NIM, or any OpenAI-compatible endpoint.
        </p>
        <Link href="/signup" className="btn-primary mt-6 inline-block px-8 py-3 text-base">
          Create free account →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-3 py-8 text-center text-xs text-text-muted">
        <p>
          TokenSaver — output compression ported from{" "}
          <a href="https://github.com/JuliusBrussee/caveman" className="text-text-secondary underline hover:text-text-primary" target="_blank" rel="noopener noreferrer">
            caveman
          </a>{" "}
          (MIT). Token counts are inferred estimates, not provider invoices.
        </p>
      </footer>
    </div>
  );
}
