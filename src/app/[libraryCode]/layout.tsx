import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, getLibraryByCode } from "@/lib/auth";
import { ProfileMenu } from "@/components/profile-menu";
import { LibrarySwitcher } from "@/components/library-switcher";
import { InviteAcceptOverlay } from "@/components/invite-accept-overlay";
import { FullLogo } from "@/components/full-logo";
import { NavTabs } from "@/components/nav-tabs";
import { MobileNav } from "@/components/mobile-nav";
import { LibraryRoleProvider } from "@/components/library-role-context";

/**
 * Wraps every real library page (Overview, Library, Scan, People, Shelves, Settings, book/
 * shelf detail) -- everything reachable at `/{code}/...`. Access is resolved entirely from
 * the "L-XXXXXX" code in the URL (getLibraryByCode, see src/lib/auth.ts), never a cookie, so
 * two tabs open on two different library codes can never cross-contaminate: one tab's
 * fetches/navigation can't change which library another tab is authorized for. A code that
 * doesn't exist, or exists but isn't one of the signed-in user's own memberships, shows a
 * plain "you don't have access" message instead of silently redirecting -- so a stale or
 * mistyped link is obvious rather than mysteriously bouncing to a different library.
 */
export default async function LibraryLayout({
  children,
  params,
}: LayoutProps<"/[libraryCode]">) {
  const { libraryCode } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/${libraryCode}`);

  const result = await getLibraryByCode(libraryCode);

  if (result.status === "unauthenticated") redirect(`/login?next=/${libraryCode}`);

  if (result.status === "forbidden") {
    return (
      <div className="flex flex-1 flex-col bg-bg">
        <header className="border-b-2 border-ink bg-surface">
          <div className="mx-auto flex max-w-[920px] items-center justify-between gap-4 px-6 py-[13px]">
            <Link href="/dashboard">
              <FullLogo height={36} />
            </Link>
            <ProfileMenu name={user.name ?? user.email} username={user.username} />
          </div>
        </header>
        <main className="relative mx-auto flex w-full max-w-[920px] flex-1 flex-col items-center justify-center gap-2 px-6 py-[30px] text-center">
          <h1 className="font-display text-2xl font-semibold text-ink">You don&apos;t have access to this library</h1>
          <p className="font-sans text-sm text-ink-soft">
            The link may be out of date, or this library may not be yours. Contact whoever shared it with you.
          </p>
          <Link href="/dashboard" className="mt-2 font-sans text-sm font-medium text-accent hover:underline">
            Go to your own library
          </Link>
        </main>
      </div>
    );
  }

  const { membership, library } = result;

  return (
    <LibraryRoleProvider role={membership.role} code={library.code}>
      <div className="flex flex-1 flex-col bg-bg">
        <header className="border-b-2 border-ink bg-surface">
          <div className="mx-auto flex max-w-[920px] items-center justify-between gap-4 px-6 py-[13px]">
            <div className="flex items-center gap-6">
              <Link href={`/${library.code}`}>
                <FullLogo height={36} />
              </Link>
              <LibrarySwitcher
                libraries={user.memberships.map((m) => m.library)}
                activeCode={library.code}
              />
            </div>
            <ProfileMenu name={user.name ?? user.email} username={user.username} />
          </div>
          <NavTabs code={library.code} />
        </header>
        <main className="mx-auto w-full max-w-[920px] flex-1 px-6 py-[30px] pb-[calc(72px+env(safe-area-inset-bottom))] sm:pb-10">
          {children}
        </main>
        <MobileNav code={library.code} />
        <Suspense fallback={null}>
          <InviteAcceptOverlay variant="overlay" />
        </Suspense>
      </div>
    </LibraryRoleProvider>
  );
}
