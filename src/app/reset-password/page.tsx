"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { formLabelClass, formInputClass } from "@/lib/form-styles";
import { isPasswordValid } from "@/lib/account-validation";
import { PasswordChecklist } from "@/components/password-checklist";

function PasswordEye({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? "Hide password" : "Show password"}
      className="absolute top-1/2 right-0 -translate-y-1/2 p-1 text-ink-faint hover:text-ink"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  );
}

export default function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const searchParams = use(props.searchParams);
  const token = typeof searchParams.token === "string" ? searchParams.token : null;

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmVisible, setPasswordConfirmVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const passwordOk = isPasswordValid(password);
  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm;
  const canSubmit = passwordOk && passwordConfirm.length > 0 && !mismatch;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }

    setDone(true);
    setSubmitting(false);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-bg px-6 py-16">
      <Wordmark />
      <div className="paper-shadow-md w-full max-w-[360px] space-y-[18px] border border-line bg-surface p-7">
        <div className="border-b border-line pb-[10px] font-mono text-[10px] tracking-[.16em] text-ink-soft uppercase">
          Reset password
        </div>

        {!token ? (
          <>
            <div>
              <h1 className="font-display text-[28px] font-semibold text-ink">Link invalid</h1>
              <p className="mt-1 font-sans text-sm text-ink-soft">
                This link is missing its token — request a new one to continue.
              </p>
            </div>
            <Link
              href="/forgot-password"
              className="block w-full rounded-[2px] bg-accent py-3 text-center font-sans text-[15px] font-medium text-on-accent hover:brightness-95"
            >
              Request a new link
            </Link>
          </>
        ) : done ? (
          <>
            <div>
              <h1 className="font-display text-[28px] font-semibold text-ink">Password updated</h1>
              <p className="mt-1 font-sans text-sm text-ink-soft">You can now sign in with your new password.</p>
            </div>
            <Link
              href="/login"
              className="block w-full rounded-[2px] bg-accent py-3 text-center font-sans text-[15px] font-medium text-on-accent hover:brightness-95"
            >
              Sign in
            </Link>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-[18px]">
            <div>
              <h1 className="font-display text-[28px] font-semibold text-ink">Choose a new password</h1>
            </div>

            {error && (
              <p className="rounded-[2px] bg-[#F5E2DE] px-3 py-2 font-mono text-xs text-accent">
                {error}{" "}
                <Link href="/forgot-password" className="underline">
                  Request a new one
                </Link>
                .
              </p>
            )}

            <div className="space-y-1">
              <label htmlFor="password" className={formLabelClass}>
                New password
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
                <PasswordEye visible={passwordVisible} onToggle={() => setPasswordVisible((v) => !v)} />
              </div>
              <PasswordChecklist password={password} />
            </div>

            <div className="space-y-1">
              <label htmlFor="passwordConfirm" className={formLabelClass}>
                Confirm new password
              </label>
              <div className="relative">
                <input
                  id="passwordConfirm"
                  type={passwordConfirmVisible ? "text" : "password"}
                  required
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className={`${formInputClass} pr-7`}
                />
                <PasswordEye visible={passwordConfirmVisible} onToggle={() => setPasswordConfirmVisible((v) => !v)} />
              </div>
              {mismatch && <p className="font-mono text-xs text-accent">Passwords don&apos;t match.</p>}
            </div>

            <button
              type="submit"
              disabled={submitting || !canSubmit}
              className="w-full rounded-[2px] bg-accent py-3 font-sans text-[15px] font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Reset password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
