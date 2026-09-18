"use client";

import { useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { formLabelClass, formInputClass } from "@/lib/form-styles";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier }),
    });
    const data = await res.json().catch(() => ({}));

    setMessage(data.message ?? "If that account exists, we've sent a password reset link to it.");
    setSubmitting(false);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-bg px-6 py-16">
      <Wordmark />
      <form
        onSubmit={onSubmit}
        className="paper-shadow-md w-full max-w-[360px] space-y-[18px] border border-line bg-surface p-7"
      >
        <div className="border-b border-line pb-[10px] font-mono text-[10px] tracking-[.16em] text-ink-soft uppercase">
          Reset password
        </div>
        <div>
          <h1 className="font-display text-[28px] font-semibold text-ink">Forgot your password?</h1>
          <p className="mt-1 font-sans text-sm text-ink-soft">
            Enter your email or username and we&apos;ll send you a link to choose a new one.
          </p>
        </div>

        {message ? (
          <p className="rounded-[2px] bg-[#DEE7DC] px-3 py-2 font-mono text-xs text-[#2F5738]">{message}</p>
        ) : (
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
        )}

        {!message && (
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-[2px] bg-accent py-3 font-sans text-[15px] font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send reset link"}
          </button>
        )}

        <p className="text-center font-sans text-sm text-ink-soft">
          <Link href="/login" className="font-medium text-accent">
            Back to sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
