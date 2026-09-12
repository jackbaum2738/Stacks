import { redirect } from "next/navigation";
import { getCurrentLibrary } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateShelfForm } from "@/components/create-shelf-form";
import { ShelfManageRow } from "@/components/shelf-manage-row";
import { MemberRow } from "@/components/member-row";
import { InviteLinkManager } from "@/components/invite-link-manager";
import { DeleteLibraryForm } from "@/components/delete-library-form";

export default async function SettingsPage() {
  const context = await getCurrentLibrary();
  if (!context) redirect("/login");

  const [shelves, members] = await Promise.all([
    prisma.shelf.findMany({
      where: { libraryId: context.library.id },
      include: { _count: { select: { copies: { where: { status: { not: "REMOVED" } } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.membership.findMany({
      where: { libraryId: context.library.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const canManage = context.membership.role === "OWNER" || context.membership.role === "ADMIN";
  const isOwner = context.membership.role === "OWNER";

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-500">{context.library.name}</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Shelves</h2>
        <CreateShelfForm />
        <ul className="divide-y divide-gray-200 dark:divide-gray-800">
          {shelves.map((shelf) => (
            <ShelfManageRow
              key={shelf.id}
              shelf={{ id: shelf.id, name: shelf.name, copyCount: shelf._count.copies }}
            />
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Members</h2>
        <ul className="divide-y divide-gray-200 dark:divide-gray-800">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={{ id: m.id, role: m.role, user: m.user }}
              canManage={canManage}
            />
          ))}
        </ul>
        {canManage && <InviteLinkManager />}
      </section>

      {isOwner && (
        <section>
          <DeleteLibraryForm libraryName={context.library.name} />
        </section>
      )}
    </div>
  );
}
