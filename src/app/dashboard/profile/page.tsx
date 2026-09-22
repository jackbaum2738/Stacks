import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile-form";
import { DeleteAccountSection } from "@/components/delete-account-section";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const libraryIds = user.memberships.map((m) => m.libraryId);
  const counts = libraryIds.length
    ? await prisma.membership.groupBy({
        by: ["libraryId"],
        where: { libraryId: { in: libraryIds } },
        _count: { _all: true },
      })
    : [];
  const memberCountByLibrary = new Map(counts.map((c) => [c.libraryId, c._count._all]));

  // "delete" (sole member) sorts before "transfer" (blocked, Owner with others) before
  // "remove" (just loses membership) -- alphabetical by library name within each group,
  // per Jack's explicit ordering when reviewing the mockup.
  const outcomeRank = { delete: 0, transfer: 1, remove: 2 } as const;
  const libraries = user.memberships
    .map((m) => {
      const memberCount = memberCountByLibrary.get(m.libraryId) ?? 1;
      const outcome: keyof typeof outcomeRank =
        memberCount === 1 ? "delete" : m.role === "OWNER" ? "transfer" : "remove";
      return { id: m.libraryId, name: m.library.name, role: m.role, memberCount, outcome };
    })
    .sort((a, b) => outcomeRank[a.outcome] - outcomeRank[b.outcome] || a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-[480px] space-y-6">
      <h1 className="font-display text-[32px] font-semibold text-ink">Profile</h1>
      <ProfileForm initialName={user.name ?? ""} initialUsername={user.username} initialEmail={user.email} />
      <DeleteAccountSection username={user.username} libraries={libraries} />
    </div>
  );
}
