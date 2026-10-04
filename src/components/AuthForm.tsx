"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "Something went wrong");
    router.push(mode === "signup" ? "/profile" : "/dashboard");
    router.refresh();
  }

  const isLogin = mode === "login";
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <form onSubmit={submit} className="card w-full max-w-sm p-8">
        <Link href="/" className="mb-6 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-plum text-lg text-ivory">z</span>
          <span className="font-serif text-2xl font-semibold text-plum">Snorlax</span>
        </Link>
        <h1 className="font-serif text-3xl font-semibold">{isLogin ? "Welcome back" : "Create your account"}</h1>
        <p className="mb-6 mt-1 text-sm text-muted">
          {isLogin ? "Your vendors have been busy." : "Start planning in under a minute."}
        </p>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" className="input mb-4" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="label" htmlFor="password">Password</label>
        <input
          id="password"
          className="input"
          type="password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
        <button className="btn mt-6 w-full" disabled={busy}>{busy ? "One moment…" : isLogin ? "Log in" : "Sign up"}</button>
        <p className="mt-4 text-center text-sm text-muted">
          {isLogin ? "New here? " : "Already have an account? "}
          <Link className="font-semibold text-plum" href={isLogin ? "/signup" : "/login"}>{isLogin ? "Sign up" : "Log in"}</Link>
        </p>
      </form>
    </main>
  );
}
