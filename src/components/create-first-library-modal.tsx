"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formInputClass } from "@/lib/form-styles";
import { LibraryLoadingOverlay } from "@/components/library-loading-overlay";

/**
 * Blocking modal shown whenever the signed-in user has no library membership -- a brand-new
 * account right after sign-up (sign-up itself no longer asks for a library name), or an existing
 * user removed from every library they were in. No backdrop-click or Escape dismissal: a library
 * is required before anything else in the dashboard is reachable, so this reappears on every
 * sign-in/visit (e.g. if the tab was closed right after account creation) until one is created.
 *
 * The backdrop is `absolute inset-0` scoped to the nested `(library)` route group's `relative`
 * wrapper div (see that layout), not `fixed` to the viewport -- the header (profile menu) and
 * site footer sit outside that container and stay fully reachable behind the dimmed content
 * area, since the popup itself never blocks account settings or the privacy link, and
 * `/dashboard/profile` (outside that route group) is unaffected entirely. Deliberately has no
 * explicit z-index: ProfileMenu's
 * dropdown (`z-10`) needs to paint above this when both are open, and this backdrop doesn't need
 * to out-rank anything since it no longer competes with page-level chrome.
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
      const data = await res.json();
      router.push(`/${data.library.code}`);
    });
  }

  return (
    <>
      <div className="absolute inset-0 flex items-center justify-center bg-[rgba(43,38,32,.45)] p-4">
        <div className="w-full max-w-[400px] rounded-[2px] border border-line-strong bg-surface p-[26px] shadow-[0_24px_44px_rgba(43,38,32,.3)]">
          <h2 className="mb-1 font-display text-2xl font-semibold text-ink">Create your library</h2>
          <p className="mb-5 font-sans text-sm text-ink-soft">
            Every account needs a library to scan books into. Give yours a name to get started.
          </p>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1">
              <input
                id="firstLibraryName"
                autoFocus
                required
                aria-label="Library name"
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
