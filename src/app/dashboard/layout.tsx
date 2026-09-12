import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentLibrary } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { LibrarySwitcher } from "@/components/library-switcher";
import { CreateFirstLibraryForm } from "@/components/create-first-library-form";

const NAV_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/scan", label: "Scan" },
  { href: "/dashboard/shelves", label: "Shelves" },
  { href: "/dashboard/search", label: "Library" },
  { href: "/dashboard/reservations", label: "Reservations" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.memberships.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="border-b border-gray-200 dark:border-gray-800">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
            <span className="font-bold">Stacks</span>
            <LogoutButton />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
          <div>
            <h1 className="text-2xl font-bold">You&apos;re not in a library right now</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Someone may have removed you from a shared library. Create your own to get started, or ask
              for a new invite link if you meant to be part of one.
            </p>
          </div>
          <CreateFirstLibraryForm />
        </main>
      </div>
    );
  }

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
            <LibrarySwitcher
              libraries={context.user.memberships.map((m) => m.library)}
              activeId={context.library.id}
            />
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
