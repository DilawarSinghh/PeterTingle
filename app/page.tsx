import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

async function getAggregateSavings() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("usage_logs")
      .select("tokens_saved");

    const total = (data ?? []).reduce(
      (sum, r) => sum + (r.tokens_saved ?? 0),
      0
    );
    return total;
  } catch {
    return 0;
  }
}

export default async function LandingPage() {
  const totalTokensSaved = await getAggregateSavings();

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <span className="text-xl font-bold text-brand-700">⛏ TokenSaver</span>
        <div className="flex items-center gap-3">
          <Link href="/login" className="btn-ghost text-sm">
            Sign in
          </Link>
          <Link href="/signup" className="btn-primary text-sm">
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
          ⛏ why use many token when few do trick
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
          Chat with AI.{" "}
          <span className="text-brand-600">Spend less.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
          TokenSaver compresses both sides of every conversation — stripping
          filler from your prompts before they go out, and instructing the AI
          to reply terse without losing technical accuracy.
        </p>

        {/* Live counter */}
        {totalTokensSaved > 0 && (
          <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-5 py-2 text-sm font-medium text-emerald-700">
            <span className="text-lg">📊</span>
            <span>
              <strong>{totalTokensSaved.toLocaleString()}</strong> tokens saved
              across all users so far
            </span>
            <span className="text-xs text-emerald-500 italic">inferred</span>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">
            Start saving tokens →
          </Link>
          <Link href="/login" className="btn-ghost text-sm">
            Already have an account
          </Link>
        </div>
      </section>

      {/* Before / after */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
            See it in action
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Normal AI — 69 tokens
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">
                "The reason your React component is re-rendering is likely
                because you're creating a new object reference on each render
                cycle. When you pass an inline object as a prop, React's shallow
                comparison sees it as a different object every time, which
                triggers a re-render. I'd recommend using useMemo to memoize the
                object."
              </p>
            </div>
            <div className="card border-brand-200 bg-brand-50 p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-500">
                TokenSaver — 19 tokens · <span className="text-emerald-600">−72%</span>
              </p>
              <p className="text-sm text-brand-900 leading-relaxed font-medium">
                "New object ref each render. Inline object prop = new ref =
                re-render. Wrap in <code className="font-mono">useMemo</code>."
              </p>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-gray-400 italic">
            Same fix, fewer words. Token counts are inferred estimates.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-10 text-center text-2xl font-bold text-gray-900">
            How it works
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: "✂",
                title: "Input compression",
                desc: "Filler phrases, redundant politeness, and whitespace noise are stripped from your message before it reaches the model.",
              },
              {
                icon: "📝",
                title: "Output instruction",
                desc: "A system prompt adapted from the caveman skill tells the AI to reply terse while keeping full technical accuracy.",
              },
              {
                icon: "📊",
                title: "Live savings",
                desc: "Per-message and cumulative token counts show exactly what was saved. All estimates labeled 'inferred'.",
              },
            ].map((item) => (
              <div key={item.title} className="card p-5">
                <div className="mb-3 text-2xl">{item.icon}</div>
                <h3 className="mb-1 text-sm font-semibold text-gray-900">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compression levels */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
            Three compression levels
          </h2>
          <div className="space-y-3">
            {[
              {
                level: "Lite",
                badge: "bg-blue-100 text-blue-700",
                desc: "Drop filler and hedging. Keep articles and full sentences. Professional but tight.",
                example: "Your component re-renders because you create a new object reference each render. Wrap it in useMemo.",
              },
              {
                level: "Full",
                badge: "bg-brand-100 text-brand-700",
                desc: "Drop articles. Fragments OK. Short synonyms. Classic caveman compression. (default)",
                example: "New object ref each render. Inline object prop = new ref = re-render. Wrap in useMemo.",
              },
              {
                level: "Ultra",
                badge: "bg-orange-100 text-orange-700",
                desc: "Strip conjunctions when cause-effect is unambiguous. One word when one word is enough.",
                example: "Inline obj prop, new ref, re-render. useMemo.",
              },
            ].map((l) => (
              <div key={l.level} className="card p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${l.badge}`}
                  >
                    {l.level}
                  </span>
                  <div>
                    <p className="text-xs text-gray-500">{l.desc}</p>
                    <p className="mt-1 text-sm italic text-gray-700">
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
      <section className="py-20 text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Start saving tokens for free
        </h2>
        <p className="mt-3 text-sm text-gray-500">
          No credit card. Works with OpenRouter, Groq, or any OpenAI-compatible
          endpoint.
        </p>
        <Link href="/signup" className="btn-primary mt-6 inline-block px-8 py-3 text-base">
          Create free account →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-xs text-gray-400">
        <p>
          TokenSaver — output compression ported from{" "}
          <a
            href="https://github.com/JuliusBrussee/caveman"
            className="underline hover:text-gray-600"
            target="_blank"
            rel="noopener noreferrer"
          >
            caveman
          </a>{" "}
          (MIT). Token counts are inferred estimates, not provider invoices.
        </p>
      </footer>
    </div>
  );
}
