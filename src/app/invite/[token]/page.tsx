import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Wordmark } from "@/components/wordmark";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "an Admin",
  MEMBER: "a Member",
  VIEW_ONLY: "a View-Only member",
};

/**
 * Logged-out landing page for an emailed invite link. A signed-in visitor is sent straight to
 * the dashboard with `?invite=` set, so the accept confirmation shows as a popup over their
 * existing content (or over the empty "no library yet" state for a brand-new account) instead
 * of a full standalone page -- see InviteAcceptOverlay.
 */
export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;

  const invite = await prisma.libraryInvite.findUnique({
    where: { token },
    include: { library: { select: { name: true } }, invitedBy: { select: { username: true } } },
  });

  if (!invite) {
    return (
      <Card title="Invite link not valid">
        <p className="font-sans text-sm text-ink-soft">
          This link is no longer valid — contact the library owner to request a new one.
        </p>
      </Card>
    );
  }

  const user = await getCurrentUser();
  if (user) {
    redirect(`/dashboard?invite=${token}`);
  }

  const inviterLabel = invite.invitedBy?.username ?? "Someone";
  const roleLabel = ROLE_LABEL[invite.role] ?? invite.role;

  return (
    <Card title={`${inviterLabel} invited you to ${invite.library.name}`}>
      <p className="font-sans text-sm text-ink-soft">
        Sign in or create an account to join this shared library on Stacks, as {roleLabel}.
      </p>
      <div className="flex flex-col gap-2">
        <Link
          href={`/register?invite=${token}`}
          className="w-full rounded-[2px] bg-accent px-4 py-3 text-center font-sans font-medium text-on-accent hover:brightness-95"
        >
          Create an account
        </Link>
        <Link
          href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
          className="w-full rounded-[2px] border border-ink px-4 py-3 text-center font-sans font-medium text-ink hover:bg-chip-hover"
        >
          Sign in
        </Link>
      </div>
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-bg px-6 py-16">
      <Wordmark />
      <div className="paper-shadow-md w-full max-w-[360px] space-y-4 border border-line bg-surface p-7">
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        {children}
      </div>
    </main>
  );
}
