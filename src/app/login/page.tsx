"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mark } from "@/components/mark";
import { formLabelClass, formInputClass } from "@/lib/form-styles";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }

    const next = new URLSearchParams(window.location.search).get("next") ?? "/dashboard";
    router.push(next);
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-bg px-6 py-16">
      <Mark size={24} />
      <form
        onSubmit={onSubmit}
        className="paper-shadow-md w-full max-w-[360px] space-y-[18px] border border-line bg-surface p-7"
      >
        <div className="border-b border-line pb-[10px] font-mono text-[10px] tracking-[.16em] text-ink-soft uppercase">
          Sign in
        </div>
        <div>
          <h1 className="font-display text-[28px] font-semibold text-ink">Sign in</h1>
          <p className="mt-1 font-sans text-sm text-ink-soft">Welcome back to your library.</p>
        </div>

        {error && (
          <p className="rounded-[2px] bg-[#F5E2DE] px-3 py-2 font-mono text-xs text-accent">{error}</p>
        )}

        <div className="space-y-1">
          <label htmlFor="email" className={formLabelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={formInputClass}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className={formLabelClass}>
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={formInputClass}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-[2px] bg-ink py-3 font-sans text-[15px] font-medium text-surface hover:brightness-95 disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-center font-sans text-sm text-ink-soft">
          No account yet?{" "}
          <Link href="/register" className="font-medium text-accent">
            Create a library
          </Link>
        </p>
      </form>
    </main>
  );
}
