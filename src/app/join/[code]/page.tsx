import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { JoinButton } from "@/components/join-button";

export default async function JoinInvitePage(props: PageProps<"/join/[code]">) {
  const { code } = await props.params;

  const library = await prisma.library.findUnique({
    where: { inviteCode: code },
    select: {
      id: true,
      name: true,
      memberships: {
        where: { role: "OWNER" },
        take: 1,
        select: { user: { select: { name: true, email: true } } },
      },
    },
  });

  if (!library) {
    return (
      <Card title="Invite link not valid">
        <p className="font-sans text-sm text-ink-soft">
          This invite link doesn&apos;t work anymore — it may have been replaced with a new one. Ask
          whoever shared it with you for a fresh link.
        </p>
      </Card>
    );
  }

  const owner = library.memberships[0]?.user;
  const inviterName = owner?.name || owner?.email || "Someone";

  const user = await getCurrentUser();

  if (!user) {
    return (
      <Card title={`${inviterName} invited you to ${library.name}`}>
        <p className="font-sans text-sm text-ink-soft">
          Sign in or create an account to join this shared library on Stacks.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href={`/register?invite=${code}`}
            className="w-full rounded-[2px] bg-accent px-4 py-3 text-center font-sans font-medium text-on-accent hover:brightness-95"
          >
            Create an account
          </Link>
          <Link
            href={`/login?next=${encodeURIComponent(`/join/${code}`)}`}
            className="w-full rounded-[2px] border border-ink px-4 py-3 text-center font-sans font-medium text-ink hover:bg-chip-hover"
          >
            Sign in
          </Link>
        </div>
      </Card>
    );
  }

  const alreadyMember = user.memberships.some((m) => m.libraryId === library.id);

  return (
    <Card title={alreadyMember ? `You're already in ${library.name}` : `${inviterName} invited you to ${library.name}`}>
      <p className="font-sans text-sm text-ink-soft">
        {alreadyMember
          ? "Switch to this library to work in it now."
          : `Signed in as ${user.email}. Join this shared library?`}
      </p>
      <JoinButton code={code} label={alreadyMember ? "Switch to this library" : `Join ${library.name}`} />
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-6 py-16">
      <div className="paper-shadow-md w-full max-w-[360px] space-y-4 border border-line bg-surface p-7">
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        {children}
      </div>
    </main>
  );
}
