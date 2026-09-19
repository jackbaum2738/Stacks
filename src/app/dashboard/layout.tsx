import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentLibrary } from "@/lib/auth";
import { ProfileMenu } from "@/components/profile-menu";
import { LibrarySwitcher } from "@/components/library-switcher";
import { CreateFirstLibraryModal } from "@/components/create-first-library-modal";
import { ZeroLibraryContent } from "@/components/zero-library-content";
import { InviteAcceptOverlay } from "@/components/invite-accept-overlay";
import { FullLogo } from "@/components/full-logo";
import { NavTabs } from "@/components/nav-tabs";
import { MobileNav } from "@/components/mobile-nav";
import { LibraryRoleProvider } from "@/components/library-role-context";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.memberships.length === 0) {
    // The blocking library-creation popup lives inside this fallback (not as an unconditional
    // sibling) so it never layers over ZeroLibraryContent's inline invite-accept card below --
    // an invite link takes over this screen entirely, in place of the new-library popup.
    const noLibraryPrompt = <CreateFirstLibraryModal />;

    return (
      <div className="flex flex-1 flex-col bg-bg">
        <header className="border-b-2 border-ink bg-surface">
          <div className="mx-auto flex max-w-[920px] items-center justify-between gap-4 px-6 py-[13px]">
            <FullLogo height={26} />
            <ProfileMenu name={user.name ?? user.email} username={user.username} />
          </div>
        </header>
        {/* `relative` scopes CreateFirstLibraryModal's `absolute inset-0` backdrop to this content
            area, so it dims only here -- the header above (profile menu) and the site footer
            below stay outside the dimmed region and fully clickable behind the popup. */}
        <main className="relative mx-auto flex w-full max-w-[920px] flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <Suspense fallback={noLibraryPrompt}>
            <ZeroLibraryContent fallback={noLibraryPrompt} />
          </Suspense>
        </main>
      </div>
    );
  }

  const context = await getCurrentLibrary();
  if (!context) redirect("/login");

  return (
    <LibraryRoleProvider role={context.membership.role}>
      <div className="flex flex-1 flex-col bg-bg">
        <header className="border-b-2 border-ink bg-surface">
          <div className="mx-auto flex max-w-[920px] items-center justify-between gap-4 px-6 py-[13px]">
            <div className="flex items-center gap-6">
              <Link href="/dashboard">
                <FullLogo height={26} />
              </Link>
              <LibrarySwitcher
                libraries={context.user.memberships.map((m) => m.library)}
                activeId={context.library.id}
              />
            </div>
            <ProfileMenu name={user.name ?? user.email} username={user.username} />
          </div>
          <NavTabs />
        </header>
        <main className="mx-auto w-full max-w-[920px] flex-1 px-6 py-[30px] pb-[calc(72px+env(safe-area-inset-bottom))] sm:pb-10">
          {children}
        </main>
        <MobileNav />
        <Suspense fallback={null}>
          <InviteAcceptOverlay variant="overlay" />
        </Suspense>
      </div>
    </LibraryRoleProvider>
  );
}
