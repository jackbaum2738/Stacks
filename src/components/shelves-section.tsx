"use client";

import { useMemo, useState } from "react";
import { CreateShelfForm } from "@/components/create-shelf-form";
import { ShelfManageRow } from "@/components/shelf-manage-row";

type Shelf = { id: string; name: string; code: string | null; copyCount: number };

/**
 * Collapsed-by-default disclosure over the shelf list, with a name/code filter once open --
 * added because a ~30-shelf library (Jack's dad's) used to just run the whole list open on
 * the page, pushing Members/Backup/Danger zone down every time. Mocked up in an Artifact
 * (project thread, 2026-09-22) before building.
 */
export function ShelvesSection({ shelves, code }: { shelves: Shelf[]; code: string }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return shelves;
    return shelves.filter((s) => s.name.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q));
  }, [shelves, filter]);

  return (
    <div className="space-y-3">
      <CreateShelfForm code={code} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between border border-line-strong bg-surface-raised px-4 py-3 font-sans text-[14.5px] font-medium text-ink hover:bg-chip-hover"
      >
        <span>
          Shelves <span className="font-mono text-xs font-normal text-ink-soft">&mdash; {shelves.length}</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`h-4 w-4 text-ink-soft transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="border border-t-0 border-line-strong bg-surface px-4 pt-3 pb-1">
          {shelves.length > 0 && (
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name or code…"
              className="mb-2 w-full border-b border-line-strong bg-transparent px-0.5 py-2 font-sans text-sm text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-none"
            />
          )}
          {shelves.length === 0 ? (
            <p className="py-3 font-sans text-sm text-ink-faint">No shelves yet &mdash; add one above.</p>
          ) : filtered.length === 0 ? (
            <p className="py-3 font-sans text-sm text-ink-faint">No shelf matches &ldquo;{filter}&rdquo;.</p>
          ) : (
            <ul className="max-h-[300px] divide-y divide-line-inner overflow-y-auto">
              {filtered.map((shelf) => (
                <ShelfManageRow key={shelf.id} shelf={shelf} code={code} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
