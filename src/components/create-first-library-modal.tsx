"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formLabelClass, formInputClass } from "@/lib/form-styles";
import { LibraryLoadingOverlay } from "@/components/library-loading-overlay";

/**
 * Blocking modal shown whenever the signed-in user has no library membership -- a brand-new
 * account right after sign-up (sign-up itself no longer asks for a library name), or an existing
 * user removed from every library they were in. No backdrop-click or Escape dismissal: a library
 * is required before anything else in the dashboard is reachable, so this reappears on every
 * sign-in/visit (e.g. if the tab was closed right after account creation) until one is created.
 */
export function CreateFirstLibraryModal() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,38,32,.45)] p-4">
        <div className="w-full max-w-[400px] rounded-[2px] border border-line-strong bg-surface p-[26px] shadow-[0_24px_44px_rgba(43,38,32,.3)]">
          <div className="mb-2 font-mono text-[11px] tracking-[.14em] text-accent-2 uppercase">Library</div>
          <h2 className="mb-1 font-display text-2xl font-semibold text-ink">Create your library</h2>
          <p className="mb-5 font-sans text-sm text-ink-soft">
            Every account needs a library to scan books into. Give yours a name to get started.
          </p>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="firstLibraryName" className={formLabelClass}>
                Library name
              </label>
              <input
                id="firstLibraryName"
                autoFocus
                required
                placeholder="e.g. Dad's Library"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={formInputClass}
              />
            </div>
            {error && <p className="font-mono text-xs text-accent">{error}</p>}
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="w-full rounded-[2px] bg-accent py-3 font-sans text-[15px] font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
            >
              {isPending ? "Creating…" : "Create library"}
            </button>
          </form>
        </div>
      </div>
      {isPending && (
        <LibraryLoadingOverlay message={`Creating ${name.trim()}…`} hint="Unlocking the reading room" />
      )}
    </>
  );
}
