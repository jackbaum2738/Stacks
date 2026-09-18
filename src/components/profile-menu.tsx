"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function ProfileMenu({ name, username }: { name: string; username: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-2 rounded-[2px] px-2 py-1.5 font-sans text-sm font-medium text-ink hover:bg-line"
      >
        <span className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-accent font-sans text-xs font-bold text-on-accent">
          {initial}
        </span>
        <span className="hidden sm:inline">{name}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-ink-soft transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="paper-shadow-sm absolute top-[calc(100%+6px)] right-0 z-10 flex min-w-[190px] flex-col border-[1.5px] border-ink bg-surface p-1.5"
        >
          <div className="border-b border-line px-2.5 py-2 pb-1.5 font-sans text-[13px] text-ink-soft">
            Signed in as
            <strong className="block truncate font-sans text-sm font-semibold text-ink">
              {username}
            </strong>
          </div>
          <Link
            href="/dashboard/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 rounded-[2px] px-2.5 py-2 font-sans text-sm text-ink hover:bg-line"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
            </svg>
            Profile
          </Link>
          <button
            role="menuitem"
            onClick={signOut}
            className="flex items-center gap-2 rounded-[2px] px-2.5 py-2 text-left font-sans text-sm text-accent hover:bg-line"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
