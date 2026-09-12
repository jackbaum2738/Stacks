import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentLibrary } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

const NAV_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/scan", label: "Scan" },
  { href: "/dashboard/shelves", label: "Shelves" },
  { href: "/dashboard/search", label: "Search" },
  { href: "/dashboard/reservations", label: "Reservations" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentLibrary();
  if (!context) redirect("/login");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-bold">
              Stacks
            </Link>
            <span className="hidden text-sm text-gray-500 sm:inline">{context.library.name}</span>
          </div>
          <LogoutButton />
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
