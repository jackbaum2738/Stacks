import { redirect } from "next/navigation";
import { getCurrentLibrary } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InviteLinkManager } from "@/components/invite-link-manager";

export default async function MembersPage() {
  const context = await getCurrentLibrary();
  if (!context) redirect("/login");

  const members = await prisma.membership.findMany({
    where: { libraryId: context.library.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const canManageInvites = context.membership.role === "OWNER" || context.membership.role === "ADMIN";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Members</h1>
        <p className="text-sm text-gray-500">Who has access to {context.library.name}.</p>
      </div>

      <ul className="divide-y divide-gray-200 dark:divide-gray-800">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">{m.user.name || m.user.email}</p>
              <p className="text-sm text-gray-500">{m.user.email}</p>
            </div>
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {m.role}
            </span>
          </li>
        ))}
      </ul>

      {canManageInvites && <InviteLinkManager />}
    </div>
  );
}
