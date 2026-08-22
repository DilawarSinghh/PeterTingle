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
    <div className="min-h-screen overflow-x-clip bg-background text-text-primary">
      {/* Nav */}
      <nav className="glass-nav sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-teal-500 text-sm font-black text-[#04110b] shadow-[0_4px_16px_-4px_rgba(52,211,153,0.6)]">
              ⛏
            </span>
            <span className="text-[17px] font-bold tracking-tight">TokenSaver</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost hidden text-sm sm:inline-flex">Sign in</Link>
            <Link href="/signup" className="btn-primary text-sm">Get started free</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative">
        <div className="grid-bg absolute inset-0" aria-hidden="true" />
        <div className="glow-orb animate-float absolute -top-24 left-1/2 h-[480px] w-[720px] -translate-x-1/2" aria-hidden="true" />

        <div className="relative mx-auto max-w-4xl px-6 pb-24 pt-20 text-center sm:pt-28">
          <div className="animate-fade-up">
            <span className="pill">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
              why use many token when few do trick
            </span>
          </div>

          <h1 className="animate-fade-up delay-100 mt-7 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Chat with AI.
            <br />
            <span className="gradient-text">Spend less.</span>
          </h1>

          <p className="animate-fade-up delay-200 mx-auto mt-6 max-w-xl text-lg leading-relaxed text-text-secondary">
            TokenSaver compresses both sides of every conversation — stripping filler
            from your prompts before they go out, and instructing the AI to reply
            terse without losing technical accuracy.
          </p>

          <div className="animate-fade-up delay-300 mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="btn-primary px-7 py-3 text-base">
              Start saving tokens
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/login" className="btn-secondary px-6 py-3 text-sm">
              Already have an account
            </Link>
          </div>

          {totalTokensSaved > 0 && (
            <div className="animate-fade-up delay-400 mt-10 inline-flex items-center gap-2.5 rounded-full border border-surface-3 bg-surface/60 px-5 py-2 text-sm text-text-secondary backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse-dot" />
              <span>
                <strong className="font-semibold text-text-primary">{totalTokensSaved.toLocaleString()}</strong>{" "}
                tokens saved across all users
              </span>
              <span className="text-xs italic text-text-muted">inferred</span>
            </div>
          )}
        </div>
      </section>

      {/* Before / after */}
      <section className="relative border-y border-white/5 bg-surface/40 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-6">
          <p className="section-label text-center">See it in action</p>
          <h2 className="mb-10 text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Same answer. <span className="gradient-text">72% fewer tokens.</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
                  Normal AI
                </p>
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                  69 tokens
                </span>
              </div>
              <p className="text-sm leading-relaxed text-text-secondary">
                "The reason your React component is re-rendering is likely because you're creating
                a new object reference on each render cycle. When you pass an inline object as a
                prop, React's shallow comparison sees it as a different object every time, which
                triggers a re-render. I'd recommend using useMemo to memoize the object."
              </p>
            </div>
            <div className="card relative overflow-hidden border-accent-muted/50 bg-accent-dim/40 p-6">
              <div className="glow-orb absolute -right-16 -top-16 h-48 w-48" aria-hidden="true" />
              <div className="relative">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">
                    TokenSaver
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-surface/80 px-2.5 py-0.5 text-xs font-medium text-text-primary">
                      19 tokens
                    </span>
                    <span className="savings-badge">−72%</span>
                  </div>
                </div>
                <p className="text-sm font-medium leading-relaxed text-text-primary">
                  "New object ref each render. Inline object prop = new ref = re-render.
                  Wrap in <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[13px] text-accent">useMemo</code>."
                </p>
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-xs italic text-text-muted">
            Same fix, fewer words. Token counts are inferred estimates.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <p className="section-label text-center">How it works</p>
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Compression, both directions
          </h2>
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
            ].map((item, i) => (
              <div key={item.title} className="card card-hover group p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-accent-muted/40 bg-accent-dim/60 text-xl transition-transform duration-300 group-hover:scale-110">
                  {item.icon}
                </div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-muted">0{i + 1}</span>
                  <h3 className="text-base font-semibold text-text-primary">{item.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-text-secondary">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compression levels */}
      <section className="border-y border-white/5 bg-surface/40 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-6">
          <p className="section-label text-center">Dial it in</p>
          <h2 className="mb-10 text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Three compression levels
          </h2>
          <div className="space-y-3">
            {[
              {
                level: "Lite",
                badgeCls: "border border-accent-muted/60 bg-accent-dim/60 text-accent",
                desc: "Drop filler and hedging. Keep articles and full sentences. Professional but tight.",
                example: "Your component re-renders because you create a new object reference each render. Wrap it in useMemo.",
              },
              {
                level: "Full",
                badgeCls: "bg-accent text-[#04110b] shadow-[0_4px_16px_-4px_rgba(52,211,153,0.5)]",
                desc: "Drop articles. Fragments OK. Short synonyms. Classic caveman compression. (default)",
                example: "New object ref each render. Inline object prop = new ref = re-render. Wrap in useMemo.",
              },
              {
                level: "Ultra",
                badgeCls: "border border-accent bg-accent-dim text-success",
                desc: "Strip conjunctions when cause-effect is unambiguous. One word when one word is enough.",
                example: "Inline obj prop, new ref, re-render. useMemo.",
              },
            ].map((l) => (
              <div key={l.level} className="card card-hover p-5">
                <div className="flex items-start gap-4">
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${l.badgeCls}`}>
                    {l.level}
                  </span>
                  <div>
                    <p className="text-xs leading-relaxed text-text-secondary">{l.desc}</p>
                    <p className="mt-2 rounded-lg border border-surface-3 bg-surface-2/50 px-3 py-2 text-sm italic text-text-primary">
                      "{l.example}"
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 text-center sm:py-32">
        <div className="glow-orb animate-float absolute left-1/2 top-1/2 h-[360px] w-[560px] -translate-x-1/2 -translate-y-1/2" aria-hidden="true" />
        <div className="relative mx-auto max-w-2xl px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Start saving tokens <span className="gradient-text">for free</span>
          </h2>
          <p className="mt-4 text-base text-text-secondary">
            No credit card. Works with OpenRouter, Groq, NVIDIA NIM, or any OpenAI-compatible endpoint.
          </p>
          <Link href="/signup" className="btn-primary mt-8 px-8 py-3.5 text-base">
            Create free account
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-xs text-text-muted sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-accent to-teal-500 text-[10px] font-black text-[#04110b]">
              ⛏
            </span>
            <span className="font-semibold text-text-secondary">TokenSaver</span>
          </div>
          <p className="text-center">
            Output compression ported from{" "}
            <a href="https://github.com/JuliusBrussee/caveman" className="text-text-secondary underline decoration-surface-3 underline-offset-2 transition-colors hover:text-accent" target="_blank" rel="noopener noreferrer">
              caveman
            </a>{" "}
            (MIT). Token counts are inferred estimates, not provider invoices.
          </p>
        </div>
      </footer>
    </div>
  );
}
