import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getDefaultLibraryCode } from "@/lib/auth";
import { ProfileMenu } from "@/components/profile-menu";
import { LibrarySwitcher } from "@/components/library-switcher";
import { FullLogo } from "@/components/full-logo";
import { NavTabs } from "@/components/nav-tabs";
import { MobileNav } from "@/components/mobile-nav";
import { LibraryRoleProvider } from "@/components/library-role-context";

/**
 * Wraps the /dashboard lobby (zero-membership gate, or an instant redirect to a real library
 * for anyone with one -- see dashboard/page.tsx) and /dashboard/profile, which stays under
 * `/dashboard` rather than moving under `/{code}` since account settings aren't scoped to any
 * one library. For a member, the header below only ever actually renders for Profile, since
 * the lobby page redirects before any of this layout's output reaches the browser -- it uses
 * the user's *default* library (see getDefaultLibraryCode) purely so the switcher/nav have
 * somewhere to point, not as an authorization decision.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.memberships.length === 0) {
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
        <main className="relative mx-auto w-full max-w-[920px] flex-1 px-6 py-[30px]">{children}</main>
      </div>
    );
  }

  const defaultCode = await getDefaultLibraryCode(user);
  const activeMembership =
    user.memberships.find((m) => m.library.code === defaultCode) ?? user.memberships[0];

  return (
    <LibraryRoleProvider role={activeMembership.role} code={activeMembership.library.code}>
      <div className="flex flex-1 flex-col bg-bg">
        <header className="border-b-2 border-ink bg-surface">
          <div className="mx-auto flex max-w-[920px] items-center justify-between gap-4 px-6 py-[13px]">
            <div className="flex items-center gap-6">
              <Link href={`/${activeMembership.library.code}`}>
                <FullLogo height={36} />
              </Link>
              <LibrarySwitcher
                libraries={user.memberships.map((m) => m.library)}
                activeCode={activeMembership.library.code}
              />
            </div>
            <ProfileMenu name={user.name ?? user.email} username={user.username} />
          </div>
          <NavTabs code={activeMembership.library.code} />
        </header>
        <main className="mx-auto w-full max-w-[920px] flex-1 px-6 py-[30px] pb-[calc(72px+env(safe-area-inset-bottom))] sm:pb-10">
          {children}
        </main>
        <MobileNav code={activeMembership.library.code} />
      </div>
    </LibraryRoleProvider>
  );
}
