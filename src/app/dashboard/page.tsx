import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, getDefaultLibraryCode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateFirstLibraryModal } from "@/components/create-first-library-modal";
import { ZeroLibraryContent } from "@/components/zero-library-content";

/**
 * The dashboard "lobby" -- not a real page for anyone with a library, just a redirect to
 * their default one's overview (see getDefaultLibraryCode in src/lib/auth.ts), preserving
 * `?invite=` so an existing account that clicked an invite link still gets the accept
 * overlay once it lands on a real library page (InviteAcceptOverlay just reads `?invite=`
 * off whatever URL it's mounted on -- see that component).
 *
 * A library-less account sees the create-library popup here instead, or the invite-accept
 * popup if they have an open invitation waiting -- looked up here server-side by email (not
 * just left to the `?invite=` param) so it survives navigating to another page and back.
 */
export default async function DashboardLobbyPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.memberships.length === 0) {
    const pendingInvite = await prisma.libraryInvite.findFirst({ where: { email: user.email } });
    const noLibraryPrompt = <CreateFirstLibraryModal />;

    return (
      <div className="relative flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 py-16 text-center">
        <Suspense fallback={noLibraryPrompt}>
          <ZeroLibraryContent fallback={noLibraryPrompt} pendingInviteToken={pendingInvite?.token ?? null} />
        </Suspense>
      </div>
    );
  }

  const code = await getDefaultLibraryCode(user);
  const params = await searchParams;
  const invite = typeof params.invite === "string" ? params.invite : null;
  redirect(invite ? `/${code}?invite=${invite}` : `/${code}`);
}
