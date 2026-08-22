"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split("@")[0] },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) { setError(error.message); setLoading(false); return; }

    if (data.user && !data.session) { setConfirmSent(true); setLoading(false); return; }

    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        display_name: displayName || email.split("@")[0],
        compression_level: "full",
      });
    }

    router.push("/chat");
    router.refresh();
  }

  async function handleGoogleSignup() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError(error.message); setLoading(false); }
  }

  if (confirmSent) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
        <div className="grid-bg absolute inset-0" aria-hidden="true" />
        <div className="glow-orb animate-float absolute -top-32 left-1/2 h-[400px] w-[600px] -translate-x-1/2" aria-hidden="true" />
        <div className="card animate-fade-up relative w-full max-w-sm space-y-4 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-accent-muted/40 bg-accent-dim/60 text-3xl">📬</div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Check your email</h2>
          <p className="text-sm leading-relaxed text-text-secondary">
            We sent a confirmation link to <strong className="text-text-primary">{email}</strong>. Click it to activate your account.
          </p>
          <Link href="/login" className="btn-ghost text-sm text-accent hover:text-accent-hover">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="grid-bg absolute inset-0" aria-hidden="true" />
      <div className="glow-orb animate-float absolute -top-32 left-1/2 h-[400px] w-[600px] -translate-x-1/2" aria-hidden="true" />
      <div className="card animate-fade-up relative w-full max-w-sm space-y-6 p-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-teal-500 text-base font-black text-[#04110b] shadow-[0_4px_16px_-4px_rgba(52,211,153,0.6)]">
              ⛏
            </span>
            <span className="text-lg font-bold tracking-tight text-text-primary">TokenSaver</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-text-primary">Create account</h1>
          <p className="mt-1.5 text-sm text-text-secondary">Start saving tokens today</p>
        </div>

        {error && (
          <div className="rounded-md border border-error bg-error-bg px-4 py-3 text-sm text-error">{error}</div>
        )}

        <button onClick={handleGoogleSignup} disabled={loading} className="btn-secondary w-full gap-2">
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-surface-3" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface px-2 text-text-muted">or email</span>
          </div>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-text-primary">Name (optional)</label>
            <input id="name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input mt-1" placeholder="Your name" autoComplete="name" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-primary">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-1" placeholder="you@example.com" autoComplete="email" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-primary">Password</label>
            <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input mt-1" placeholder="8+ characters" autoComplete="new-password" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-text-secondary">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:text-accent-hover">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
