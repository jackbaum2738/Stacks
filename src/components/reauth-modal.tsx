"use client";

import { useState } from "react";
import { formLabelClass, formInputClass } from "@/lib/form-styles";

/** Confirms the signed-in user's current password before committing a sensitive account
 * change (username, email, password). Dismissing it (Cancel or clicking outside) cancels
 * the pending change without saving anything. */
export function ReauthModal({
  open,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: (currentPassword: string) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="paper-shadow-lg w-full max-w-[380px] border-2 border-ink bg-surface p-6">
        <div className="mb-4 border-b border-line pb-2.5 font-mono text-[10px] tracking-[.16em] text-ink-soft uppercase">
          Confirm it&apos;s you
        </div>
        <div className="mb-1 flex items-center gap-2 text-accent-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <h3 className="font-display text-[19px] font-semibold text-ink">Enter your current password</h3>
        </div>
        <p className="mb-4 font-sans text-[13px] text-ink-soft">To save this change, confirm your current password.</p>

        <div className="mb-4 space-y-1">
          <label htmlFor="reauth-password" className={formLabelClass}>
            Current password
          </label>
          <div className="relative">
            <input
              id="reauth-password"
              type={visible ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${formInputClass} pr-7`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && password && !busy) onConfirm(password);
              }}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-0 -translate-y-1/2 p-1 text-ink-faint hover:text-ink"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
          {error && <p className="font-mono text-xs text-accent">{error}</p>}
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            disabled={!password || busy}
            onClick={() => onConfirm(password)}
            className="rounded-[2px] bg-accent px-4 py-[9px] font-sans text-[13px] font-semibold text-on-accent hover:brightness-95 disabled:opacity-40"
          >
            {busy ? "Confirming…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[2px] border border-line-strong px-4 py-[9px] font-sans text-[13px] font-semibold text-ink-soft hover:bg-line hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
