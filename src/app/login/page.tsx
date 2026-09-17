"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { formLabelClass, formInputClass } from "@/lib/form-styles";

export default function LoginPage(props: PageProps<"/login">) {
  const router = useRouter();
  const searchParams = use(props.searchParams);
  const next = typeof searchParams.next === "string" ? searchParams.next : null;
  // The only "next" this app ever sends here is /join/{code}, from the invite
  // flow's "Sign in" link — recover the code so switching to sign-up doesn't
  // lose it.
  const inviteCode = next?.match(/^\/join\/([^/]+)$/)?.[1] ?? null;

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }

    router.push(next ?? "/dashboard");
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-bg px-6 py-16">
      <Wordmark />
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
          <label htmlFor="identifier" className={formLabelClass}>
            Email or username
          </label>
          <input
            id="identifier"
            type="text"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={formInputClass}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className={formLabelClass}>
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={passwordVisible ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${formInputClass} pr-7`}
            />
            <button
              type="button"
              onClick={() => setPasswordVisible((v) => !v)}
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-0 -translate-y-1/2 p-1 text-ink-faint hover:text-ink"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
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
          <Link
            href={inviteCode ? `/register?invite=${inviteCode}` : "/register"}
            className="font-medium text-accent"
          >
            Sign up
          </Link>
        </p>
      </form>
    </main>
  );
}
