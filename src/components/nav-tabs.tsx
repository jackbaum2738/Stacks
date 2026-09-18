"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLibraryRole } from "@/components/library-role-context";

const NAV_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/scan", label: "Scan", requiresEdit: true },
  { href: "/dashboard/search", label: "Library" },
  { href: "/dashboard/people", label: "People" },
  { href: "/dashboard/shelves", label: "Shelves" },
  { href: "/dashboard/reservations", label: "Reservations" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function NavTabs() {
  const pathname = usePathname();
  const { canEdit } = useLibraryRole();

  return (
    <nav className="mx-auto flex max-w-[920px] overflow-x-auto px-6">
      {NAV_LINKS.filter((link) => !link.requiresEdit || canEdit).map((link) => {
        const active =
          link.href === "/dashboard" ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap px-[14px] py-[9px] font-medium text-[13px] ${
              active ? "bg-ink text-surface" : "text-ink-muted hover:bg-chip-hover"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
