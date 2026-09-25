"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "an Admin",
  MEMBER: "a Member",
  VIEW_ONLY: "a View-Only member",
};

type InvitePreview = { libraryName: string; inviterUsername: string | null; role: string };

/**
 * The confirm-to-join popup Jack asked for: shown after sign-in/sign-up (or when an already
 * signed-in member clicks an invite link), never joining the moment the link is opened. Reads
 * `?invite=` off the URL rather than a page prop since this renders inside the dashboard
 * layout, which -- unlike a page -- doesn't receive `searchParams` itself.
 *
 * "overlay" sits on top of the normal dashboard (over existing content, dimmed backdrop);
 * "inline" is for the zero-library state, where there's no dashboard chrome behind it to sit
 * over -- it replaces the "create your first library" prompt entirely for a brand-new account
 * that signed up via this invite, per Jack's "instead of the new library popup" instruction.
 *
 * `token` is optional: when omitted (the "overlay" use), the token comes from the `?invite=`
 * URL param as before. `ZeroLibraryContent` passes it explicitly instead, since its token can
 * come from a server-side pending-invite lookup with no URL param to match -- `onDismiss` is
 * how "Not now" is reported back in that case, since there's then no `?invite=` for this
 * component to strip from the URL itself.
 */
export function InviteAcceptOverlay({
  variant,
  token: tokenProp,
  onDismiss,
}: {
  variant: "overlay" | "inline";
  token?: string;
  onDismiss?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get("invite");
  const token = tokenProp ?? urlToken;

  const [preview, setPreview] = useState<InvitePreview | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/invite/${token}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => !cancelled && setPreview(data))
      .catch(() => !cancelled && setPreview(null));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const dismiss = useCallback(() => {
    if (urlToken) {
      const params = new URLSearchParams(searchParams);
      params.delete("invite");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    }
    onDismiss?.();
  }, [pathname, router, searchParams, urlToken, onDismiss]);

  async function accept() {
    if (!token) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/invite/${token}/accept`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(data.error ?? "Something went wrong");
      return;
    }
    onDismiss?.();
    router.push(`/${data.libraryCode}`);
  }

  if (!token) return null;

  const card = (
    <div className="w-full max-w-[380px] rounded-[2px] border border-line-strong bg-surface p-[26px] shadow-[0_24px_44px_rgba(43,38,32,.3)]">
      {preview === undefined ? (
        <p className="font-sans text-sm text-ink-soft">Loading invitation…</p>
      ) : preview === null ? (
        <>
          <h2 className="mb-2 font-display text-2xl font-semibold text-ink">Invite no longer valid</h2>
          <p className="mb-5 font-sans text-sm leading-[1.55] text-ink-soft">
            This link is no longer valid — contact the library owner to request a new one.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-[2px] bg-ink px-4 py-2 font-sans text-sm font-medium text-surface hover:brightness-95"
            >
              Close
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="mb-2 font-display text-2xl font-semibold text-ink">
            {preview.inviterUsername ? `${preview.inviterUsername} invited you` : "You're invited"}
          </h2>
          <p className="mb-5 font-sans text-sm leading-[1.55] text-ink-soft">
            Join <strong className="text-ink">{preview.libraryName}</strong> as{" "}
            {ROLE_LABEL[preview.role] ?? preview.role}?
          </p>
          {error && <p className="mb-3 font-mono text-xs text-accent">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={dismiss}
              disabled={busy}
              className="rounded-[2px] border border-line-strong px-3 py-2 font-sans text-sm font-medium text-ink hover:bg-chip-hover disabled:opacity-50"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={accept}
              disabled={busy}
              className="rounded-[2px] bg-accent px-3 py-2 font-sans text-sm font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
            >
              {busy ? "Joining…" : `Join ${preview.libraryName}`}
            </button>
          </div>
        </>
      )}
    </div>
  );

  if (variant === "inline") {
    return <div className="flex w-full flex-1 items-center justify-center">{card}</div>;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(43,38,32,.45)] p-4">
      {card}
    </div>
  );
}
