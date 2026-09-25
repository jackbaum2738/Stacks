"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLibraryRole } from "@/components/library-role-context";

const NAV_LINKS = [
  { path: "", label: "Overview" },
  { path: "/scan", label: "Scan", requiresEdit: true },
  { path: "/library", label: "Library" },
  { path: "/people", label: "People" },
  { path: "/shelves", label: "Shelves" },
  { path: "/settings", label: "Settings" },
];

export function NavTabs({ code }: { code: string }) {
  const pathname = usePathname();
  const { canEdit } = useLibraryRole();

  return (
    <nav className="mx-auto hidden max-w-[920px] overflow-x-auto px-6 sm:flex">
      {NAV_LINKS.filter((link) => !link.requiresEdit || canEdit).map((link) => {
        const href = `/${code}${link.path}`;
        const active = link.path === "" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={link.path}
            href={href}
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
