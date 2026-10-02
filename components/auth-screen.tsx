"use client";

import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { Spinner } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function AuthScreen() {
  const { signIn, signUp } = useApp();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isSupabaseConfigured) {
    return (
      <div className="glow flex min-h-screen items-center justify-center px-4">
        <div className="card max-w-md rounded-2xl p-8 text-center">
          <h1 className="text-xl font-bold">Backend not configured</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Add <code className="text-brand-2">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="text-brand-2">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to{" "}
            <code>.env.local</code>, then restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        await signUp(email, password, username);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glow flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-3xl shadow-lg shadow-brand/30">
            🌍
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Globe<span className="text-brand">Circle</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Meet people anywhere on earth. We rank everyone for you by shared
            interests, language and distance.
          </p>
        </div>

        <form onSubmit={submit} className="card animate-in space-y-4 rounded-2xl p-6">
          <div className="flex rounded-lg border border-line p-1">
            {(["signup", "signin"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-md py-1.5 text-sm transition ${
                  mode === m ? "bg-brand font-semibold text-white" : "text-zinc-600"
                }`}
              >
                {m === "signup" ? "Join" : "Sign in"}
              </button>
            ))}
          </div>

          {mode === "signup" && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-600">
                Username
              </span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="your_handle"
                required
                minLength={3}
                className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-600">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-600">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand to-brand-2 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? (
              <Spinner label="One moment…" />
            ) : mode === "signup" ? (
              "Start matching"
            ) : (
              "Sign in"
            )}
          </button>

          <p className="text-center text-xs text-zinc-500">
            {mode === "signup"
              ? "Already a member? Switch to sign in."
              : "New here? Create an account in seconds."}
          </p>
        </form>
      </div>
    </div>
  );
}