"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LibraryLoadingOverlay } from "@/components/library-loading-overlay";

type WipeCounts = { copies: number; shelves: number; reservations: number; bookOverrides: number };

/**
 * Wipe and delete, folded into one bordered section instead of two settings rows -- see
 * CLAUDE.md's "wipe library" note for why they share a component and confirmation pattern.
 */
export function DangerZoneSection({
  libraryName,
  canWipe,
  canDelete,
  wipeCounts,
}: {
  libraryName: string;
  canWipe: boolean;
  canDelete: boolean;
  wipeCounts: WipeCounts | null;
}) {
  if (!canWipe && !canDelete) return null;

  return (
    <div className="divide-y divide-line-inner border border-line-strong bg-surface">
      {canWipe && wipeCounts && <WipeLibraryAction libraryName={libraryName} counts={wipeCounts} />}
      {canDelete && <DeleteLibraryAction libraryName={libraryName} />}
    </div>
  );
}

function WipeLibraryAction({ libraryName, counts }: { libraryName: string; counts: WipeCounts }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/library/wipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmName }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-3 p-4">
      <div>
        <h2 className="font-mono text-[11px] tracking-[.16em] text-accent-2 uppercase">Wipe library</h2>
        <p className="mt-1 font-sans text-sm text-ink-soft">
          Clears out every shelf, copy, and reservation so {libraryName}&apos;s catalog starts empty.
          Members, roles, and invite links are untouched. This can&apos;t be undone.
        </p>
      </div>

      {!open && !done && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-[2px] border border-line-strong px-4 py-2 font-sans text-sm text-ink hover:bg-row-hover"
        >
          Wipe library&hellip;
        </button>
      )}

      {open && !done && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-px border border-line-inner bg-line-inner sm:grid-cols-4">
            <div className="bg-surface px-3.5 py-3">
              <div className="font-mono text-xl text-ink tabular-nums">{counts.copies}</div>
              <div className="mt-0.5 text-[12.5px] text-ink-soft">Copies</div>
            </div>
            <div className="bg-surface px-3.5 py-3">
              <div className="font-mono text-xl text-ink tabular-nums">{counts.shelves}</div>
              <div className="mt-0.5 text-[12.5px] text-ink-soft">Shelves</div>
            </div>
            <div className="bg-surface px-3.5 py-3">
              <div className="font-mono text-xl text-ink tabular-nums">{counts.reservations}</div>
              <div className="mt-0.5 text-[12.5px] text-ink-soft">Active reservations</div>
            </div>
            <div className="bg-surface px-3.5 py-3">
              <div className="font-mono text-xl text-ink tabular-nums">{counts.bookOverrides}</div>
              <div className="mt-0.5 text-[12.5px] text-ink-soft">Book corrections</div>
            </div>
          </div>
          <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={`Type "${libraryName}" to confirm`}
              className="min-w-0 flex-1 border-b border-line-strong bg-transparent px-0.5 py-2 font-sans text-sm text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-none"
            />
            <button
              type="submit"
              disabled={busy || confirmName !== libraryName}
              className="rounded-[2px] bg-accent-2 px-4 py-2 font-sans text-sm font-medium text-on-accent hover:brightness-95 disabled:opacity-40"
            >
              Wipe library
            </button>
          </form>
          {error && <p className="font-mono text-xs text-accent">{error}</p>}
        </div>
      )}

      {done && (
        <p className="font-mono text-xs text-reserved-text">
          ✓ {libraryName} wiped &mdash; 0 shelves, 0 copies, 0 reservations remain.
        </p>
      )}
    </div>
  );
}

function DeleteLibraryAction({ libraryName }: { libraryName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/library", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName }),
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
    <div className="space-y-3 p-4">
      {isPending && (
        <LibraryLoadingOverlay message={`Deleting ${libraryName}…`} hint="Returning every book" />
      )}
      <div>
        <h2 className="font-mono text-[11px] tracking-[.16em] text-accent uppercase">Delete this library</h2>
        <p className="mt-1 font-sans text-sm text-ink-soft">
          Permanently deletes {libraryName}, every shelf, book, and reservation in it, for everyone with
          access. This can&apos;t be undone.
        </p>
      </div>

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-[2px] border border-line-strong px-4 py-2 font-sans text-sm text-ink hover:bg-row-hover"
        >
          Delete library&hellip;
        </button>
      )}

      {open && (
        <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
          <input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={`Type "${libraryName}" to confirm`}
            className="min-w-0 flex-1 border-b border-line-strong bg-transparent px-0.5 py-2 font-sans text-sm text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={isPending || confirmName !== libraryName}
            className="rounded-[2px] bg-accent px-4 py-2 font-sans text-sm font-medium text-on-accent hover:brightness-95 disabled:opacity-40"
          >
            Delete library
          </button>
        </form>
      )}
      {error && <p className="font-mono text-xs text-accent">{error}</p>}
    </div>
  );
}
