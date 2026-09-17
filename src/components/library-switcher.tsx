"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LibraryLoadingOverlay } from "@/components/library-loading-overlay";

const NEW_LIBRARY_ID = "__new__";

export function LibrarySwitcher({
  libraries,
  activeId,
}: {
  libraries: { id: string; name: string }[];
  activeId: string;
}) {
  const router = useRouter();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [overlay, setOverlay] = useState<{ message: string; hint: string } | null>(null);

  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The keyboard-navigable sequence: every library, then the "+ New library" action.
  const navIds = [...libraries.map((lib) => lib.id), NEW_LIBRARY_ID];

  const active = libraries.find((lib) => lib.id === activeId) ?? libraries[0];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open && highlighted) itemRefs.current[highlighted]?.scrollIntoView({ block: "nearest" });
  }, [open, highlighted]);

  function openMenu() {
    setOpen(true);
    setHighlighted(activeId);
  }

  function closeMenu(returnFocus: boolean) {
    setOpen(false);
    setHighlighted(null);
    if (returnFocus) triggerRef.current?.focus();
  }

  function selectLibrary(id: string) {
    closeMenu(true);
    if (id === activeId) return;
    const target = libraries.find((lib) => lib.id === id);
    setOverlay({ message: `Switching to ${target?.name ?? "library"}…`, hint: "Dusting off the shelves" });
    startTransition(async () => {
      await fetch("/api/library/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryId: id }),
      });
      router.push("/dashboard");
      router.refresh();
    });
  }

  function startCreate() {
    closeMenu(false);
    setCreating(true);
  }

  function createLibrary(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = newName;
    setOverlay({ message: `Creating ${name}…`, hint: "Unlocking the reading room" });
    startTransition(async () => {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong");
        setOverlay(null);
        return;
      }
      setCreating(false);
      setNewName("");
      router.push("/dashboard");
      router.refresh();
    });
  }

  function moveHighlight(delta: 1 | -1) {
    const from = highlighted ? navIds.indexOf(highlighted) : -1;
    const next = from === -1 ? (delta === 1 ? 0 : navIds.length - 1) : (from + delta + navIds.length) % navIds.length;
    setHighlighted(navIds[next]);
  }

  function activateHighlighted() {
    if (!highlighted) return;
    if (highlighted === NEW_LIBRARY_ID) startCreate();
    else void selectLibrary(highlighted);
  }

  function onTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlighted(navIds[0] ?? null);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlighted(navIds[navIds.length - 1] ?? null);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activateHighlighted();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
    } else if (e.key === "Tab") {
      closeMenu(false);
    } else if (e.key.length === 1 && /[a-z0-9]/i.test(e.key)) {
      typeaheadRef.current += e.key.toLowerCase();
      clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = setTimeout(() => {
        typeaheadRef.current = "";
      }, 600);
      const match = libraries.find((lib) => lib.name.toLowerCase().startsWith(typeaheadRef.current));
      if (match) setHighlighted(match.id);
    }
  }

  if (creating) {
    return (
      <>
        <form onSubmit={createLibrary} className="flex items-center gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New library name"
            required
            className="w-40 border-b border-line-strong bg-transparent px-0.5 py-1 font-sans text-sm text-ink focus-visible:border-accent focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-[2px] bg-ink px-2 py-1 font-sans text-sm font-medium text-surface hover:brightness-95 disabled:opacity-50"
          >
            Create
          </button>
          <button type="button" onClick={() => setCreating(false)} className="font-sans text-sm text-ink-soft">
            Cancel
          </button>
          {error && <p className="font-sans text-sm text-accent">{error}</p>}
        </form>
        {isPending && overlay && <LibraryLoadingOverlay message={overlay.message} hint={overlay.hint} />}
      </>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      {isPending && overlay && <LibraryLoadingOverlay message={overlay.message} hint={overlay.hint} />}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && highlighted ? `${listboxId}-${highlighted}` : undefined}
        className={`flex max-w-[10rem] items-center gap-2 truncate rounded-[2px] border py-1 pr-2 pl-[9px] font-mono text-[13px] text-ink uppercase hover:bg-row-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-2 sm:max-w-none ${
          open ? "border-accent-2" : "border-line-strong"
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-left">{active?.name}</span>
        <span className={`shrink-0 text-[9px] text-ink-faint transition-transform ${open ? "rotate-180 text-accent-2" : ""}`}>▾</span>
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Your libraries"
          className="paper-shadow-sm absolute top-[calc(100%+6px)] left-0 z-30 max-h-[260px] w-max min-w-full max-w-[280px] overflow-y-auto rounded-[2px] border border-line-strong bg-surface p-1"
        >
          {libraries.map((lib) => (
            <li
              key={lib.id}
              id={`${listboxId}-${lib.id}`}
              ref={(el) => {
                itemRefs.current[lib.id] = el;
              }}
              role="option"
              aria-selected={lib.id === activeId}
              onMouseEnter={() => setHighlighted(lib.id)}
              onClick={() => selectLibrary(lib.id)}
              className={`flex cursor-pointer items-center gap-2 rounded-[2px] px-2.5 py-1.5 font-sans text-sm text-ink hover:bg-chip-hover ${
                lib.id === activeId ? "bg-chip-hover" : ""
              } ${lib.id === highlighted ? "outline outline-1 -outline-offset-1 outline-line-inner" : ""}`}
            >
              <span className={`w-3.5 shrink-0 text-center text-xs text-accent-2 ${lib.id === activeId ? "" : "invisible"}`}>✓</span>
              <span className="min-w-0 flex-1 truncate">{lib.name}</span>
            </li>
          ))}
          <li role="separator" className="my-1 h-px bg-line-inner" />
          <li
            id={`${listboxId}-${NEW_LIBRARY_ID}`}
            ref={(el) => {
              itemRefs.current[NEW_LIBRARY_ID] = el;
            }}
            role="option"
            aria-selected={false}
            onMouseEnter={() => setHighlighted(NEW_LIBRARY_ID)}
            onClick={startCreate}
            className={`flex cursor-pointer items-center gap-2 rounded-[2px] px-2.5 py-2 font-sans text-sm font-semibold text-accent hover:bg-chip-hover ${
              highlighted === NEW_LIBRARY_ID ? "outline outline-1 -outline-offset-1 outline-line-inner" : ""
            }`}
          >
            <span className="w-3.5 shrink-0 text-center font-mono text-xs font-medium">+</span>
            <span>New library…</span>
          </li>
        </ul>
      )}
    </div>
  );
}
