"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLibraryRole } from "@/components/library-role-context";

const PRIMARY_LINKS = [
  {
    href: "/dashboard/scan",
    label: "Scan",
    requiresEdit: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <rect x="3" y="6" width="2" height="12" />
        <rect x="7" y="6" width="1" height="12" />
        <rect x="10" y="6" width="3" height="12" />
        <rect x="15" y="6" width="1" height="12" />
        <rect x="18" y="6" width="2" height="12" />
      </svg>
    ),
  },
  {
    href: "/dashboard/search",
    label: "Library",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/people",
    label: "People",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

const MORE_LINKS = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="8" height="8" rx="1" />
        <rect x="13" y="3" width="8" height="8" rx="1" />
        <rect x="3" y="13" width="8" height="8" rx="1" />
        <rect x="13" y="13" width="8" height="8" rx="1" />
      </svg>
    ),
  },
  {
    href: "/dashboard/shelves",
    label: "Shelves",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="1" />
        <line x1="3" y1="11" x2="21" y2="11" />
        <line x1="3" y1="16" x2="21" y2="16" />
      </svg>
    ),
  },
  {
    href: "/dashboard/reservations",
    label: "Reservations",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 3h12v18l-6-4-6 4V3z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

export function MobileNav() {
  const pathname = usePathname();
  const { canEdit } = useLibraryRole();
  const [open, setOpen] = useState(false);

  const primaryLinks = PRIMARY_LINKS.filter((link) => !link.requiresEdit || canEdit);
  const onMorePage = MORE_LINKS.some((link) => isActive(pathname, link.href));

  return (
    <>
      {open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink/40 sm:hidden"
        />
      )}
      <div
        role="menu"
        aria-hidden={!open}
        className={`fixed inset-x-0 bottom-0 z-40 rounded-t-[14px] border-t-2 border-ink bg-surface transition-transform duration-200 ease-out sm:hidden ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mt-2 mb-1 h-1 w-8 rounded-full bg-line-strong" />
        {MORE_LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 border-b border-line-inner px-4 py-3 font-sans text-[13.5px] font-semibold last:border-b-0 ${
                active ? "text-accent" : "text-ink"
              }`}
            >
              <span className={`flex h-4 w-4 flex-shrink-0 ${active ? "text-accent" : "text-ink-soft"}`}>
                {link.icon}
              </span>
              {link.label}
            </Link>
          );
        })}
      </div>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-ink bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <div className="flex">
          {primaryLinks.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 font-sans text-[10px] font-semibold ${
                  active ? "text-accent" : "text-ink-soft"
                }`}
              >
                <span className="h-5 w-5">{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup="true"
            className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 font-sans text-[10px] font-semibold ${
              open || onMorePage ? "text-accent" : "text-ink-soft"
            }`}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="5" cy="12" r="1.4" />
              <circle cx="12" cy="12" r="1.4" />
              <circle cx="19" cy="12" r="1.4" />
            </svg>
            More
          </button>
        </div>
      </nav>
    </>
  );
}
