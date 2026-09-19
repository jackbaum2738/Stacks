import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateFirstLibraryModal } from "@/components/create-first-library-modal";
import { ZeroLibraryContent } from "@/components/zero-library-content";

/**
 * Wraps every dashboard route that needs an active library (Overview, Library, Scan, People,
 * Shelves, Settings, book/shelf detail) -- everything under `/dashboard` except `/dashboard/profile`,
 * which lives outside this route group specifically so it stays reachable without a library
 * (see the top-level dashboard layout). A library-less account sees the create-library popup
 * here in place of the real page content, or the invite-accept popup instead if they have an
 * open invitation waiting.
 *
 * The pending invite is looked up here server-side by email rather than left to `ZeroLibraryContent`'s
 * own `?invite=` URL param alone, so it survives navigating to another page (Profile, the site
 * footer's Privacy link) and back -- a plain revisit to `/dashboard` carries no query string, and
 * the popup should still remember there's an invitation to accept rather than falling back to
 * "create your own library" as if none existed.
 */
export default async function LibraryGateLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.memberships.length === 0) {
    const email = user?.email;
    const pendingInvite = email ? await prisma.libraryInvite.findFirst({ where: { email } }) : null;
    const noLibraryPrompt = <CreateFirstLibraryModal />;

    return (
      <div className="relative flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 py-16 text-center">
        <Suspense fallback={noLibraryPrompt}>
          <ZeroLibraryContent fallback={noLibraryPrompt} pendingInviteToken={pendingInvite?.token ?? null} />
        </Suspense>
      </div>
    );
  }

  return <>{children}</>;
}
