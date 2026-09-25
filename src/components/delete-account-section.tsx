"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { ReauthModal } from "@/components/reauth-modal";
import { LibraryLoadingOverlay } from "@/components/library-loading-overlay";

type Outcome = "delete" | "transfer" | "remove";
type LibraryRow = { id: string; code: string; name: string; role: Role; memberCount: number; outcome: Outcome };

const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEW_ONLY: "View Only",
};

const ROW_TONE: Record<Outcome, string> = {
  delete: "bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))]",
  transfer: "bg-[color-mix(in_srgb,var(--pill-reserved-fg)_10%,var(--surface))]",
  remove: "",
};

/**
 * Deletes the signed-in user's own account. The tricky part isn't the delete itself -- it's
 * what happens to each library they belong to, since a library can outlive them (shared),
 * die with them (they're its only member), or block them entirely (Owner with others still
 * in it -- Membership has no "no owner" state, so ownership has to move first). Mocked up as
 * an Artifact and approved by Jack before building: deletion group first, then the ownership-
 * transfer blockers, then untouched libraries, alphabetical within each group; confirm by
 * typing your username, then the existing password re-auth modal, then the standard loading
 * takeover (see CLAUDE.md's "Standard loading takeover" note) while the account is actually
 * deleted, landing on /account-deleted.
 */
export function DeleteAccountSection({ username, libraries }: { username: string; libraries: LibraryRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthKey, setReauthKey] = useState(0);
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [overlay, setOverlay] = useState<{ message: string; hint: string } | null>(null);

  const blocking = libraries.filter((l) => l.outcome === "transfer");
  const canDelete = confirmInput === username && blocking.length === 0;

  function openReauth() {
    setReauthKey((k) => k + 1);
    setReauthOpen(true);
  }

  function switchAndOpenSettings(libraryCode: string, libraryName: string) {
    setOverlay({ message: `Switching to ${libraryName}…`, hint: "Dusting off the shelves" });
    startTransition(async () => {
      router.push(`/${libraryCode}/settings`);
    });
  }

  function confirmReauth(currentPassword: string) {
    setReauthOpen(false);
    setError(null);
    setOverlay({ message: "Closing your account…", hint: "Returning your library card" });
    startTransition(async () => {
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmUsername: confirmInput, currentPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          openReauth();
          setReauthError(data.error ?? "That password isn't right");
          return;
        }
        setError(data.error ?? "Something went wrong");
        router.refresh();
        return;
      }
      router.push("/account-deleted");
    });
  }

  function cancelReauth() {
    setReauthOpen(false);
    setReauthError(null);
  }

  return (
    <div className="border border-line-strong bg-surface">
      {isPending && overlay && <LibraryLoadingOverlay message={overlay.message} hint={overlay.hint} />}

      <div className="space-y-3 p-4">
        <div>
          <h2 className="font-mono text-[11px] tracking-[.16em] text-accent uppercase">Delete your account</h2>
          <p className="mt-1 font-sans text-sm text-ink-soft">
            Permanently removes your name, username, email, and password from Stacks. You won&apos;t be able to
            sign back in, and this can&apos;t be undone.
          </p>
        </div>

        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-[2px] border border-line-strong px-4 py-2 font-sans text-sm text-ink hover:bg-row-hover"
          >
            Delete my account&hellip;
          </button>
        )}

        {open && (
          <div className="space-y-4">
            <p className="font-sans text-sm text-ink-soft">
              Deleting your account removes your name, username, email, and password from Stacks for good &mdash;
              you won&apos;t be able to sign back in. Here&apos;s what happens to each library you belong to:
            </p>

            {libraries.length > 0 && (
              <div className="divide-y divide-line-inner border border-line-inner">
                {libraries.map((lib) => (
                  <div key={lib.id} className={`flex gap-3 p-3.5 ${ROW_TONE[lib.outcome]}`}>
                    <LibraryRowIcon outcome={lib.outcome} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-sans text-sm font-semibold text-ink">{lib.name}</span>
                        <span className="rounded-[2px] border border-line-strong px-1.5 py-px font-mono text-[10px] tracking-[.08em] text-ink-soft uppercase">
                          {ROLE_LABEL[lib.role]}
                        </span>
                      </div>
                      {lib.outcome === "delete" && (
                        <p className="mt-1 font-sans text-[13px] leading-snug text-accent">
                          <strong className="font-semibold">Library will be deleted</strong> &mdash; you&apos;re its
                          only member, so nothing is left behind for anyone else.
                        </p>
                      )}
                      {lib.outcome === "transfer" && (
                        <>
                          <p className="mt-1 font-sans text-[13px] leading-snug text-reserved-text">
                            <strong className="font-semibold">Blocked</strong> &mdash; you&apos;re the Owner and{" "}
                            {lib.memberCount - 1} other{lib.memberCount - 1 === 1 ? "" : "s"} still belong to this
                            library. Transfer ownership before you can delete your account.
                          </p>
                          <button
                            type="button"
                            onClick={() => switchAndOpenSettings(lib.code, lib.name)}
                            className="mt-1.5 font-sans text-[12.5px] font-semibold text-accent-2 hover:underline"
                          >
                            Transfer ownership in Settings &rarr;
                          </button>
                        </>
                      )}
                      {lib.outcome === "remove" && (
                        <p className="mt-1 font-sans text-[13px] leading-snug text-ink-soft">
                          You&apos;ll be removed. This library and its other {lib.memberCount - 1} member
                          {lib.memberCount - 1 === 1 ? "" : "s"} are unaffected.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {blocking.length > 0 && (
              <p className="flex items-center gap-1.5 font-sans text-[13px] font-semibold text-reserved-text">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Resolve the highlighted {blocking.length === 1 ? "library" : "libraries"} above before you can
                continue.
              </p>
            )}

            <div className="space-y-2 border-t border-dashed border-line-strong pt-4">
              <p className="font-sans text-[13px] text-ink-soft">Type your username to confirm:</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder={`Type "${username}" to confirm`}
                  className="min-w-0 flex-1 border-b border-line-strong bg-transparent px-0.5 py-2 font-sans text-sm text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-none"
                />
                <button
                  type="button"
                  disabled={!canDelete}
                  onClick={openReauth}
                  className="rounded-[2px] bg-accent px-4 py-2 font-sans text-sm font-medium text-on-accent hover:brightness-95 disabled:opacity-40"
                >
                  Delete my account
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmInput("");
                setError(null);
              }}
              className="font-sans text-[13px] font-semibold text-ink-soft hover:text-ink"
            >
              Cancel
            </button>

            {error && <p className="font-mono text-xs text-accent">{error}</p>}
          </div>
        )}
      </div>

      <ReauthModal key={reauthKey} open={reauthOpen} busy={false} error={reauthError} onConfirm={confirmReauth} onCancel={cancelReauth} />
    </div>
  );
}

function LibraryRowIcon({ outcome }: { outcome: Outcome }) {
  if (outcome === "delete") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-accent" aria-hidden>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  if (outcome === "transfer") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-reserved-text" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-ink-faint" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
