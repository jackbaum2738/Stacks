import { redirect } from "next/navigation";
import { getCurrentLibrary } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateShelfForm } from "@/components/create-shelf-form";
import { ShelfManageRow } from "@/components/shelf-manage-row";
import { MemberRow } from "@/components/member-row";
import { InviteLinkManager } from "@/components/invite-link-manager";
import { DeleteLibraryForm } from "@/components/delete-library-form";
import { BackupImportSection } from "@/components/backup-import-section";

export default async function SettingsPage() {
  const context = await getCurrentLibrary();
  if (!context) redirect("/login");

  const [shelves, members, backupInfo] = await Promise.all([
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
    prisma.library.findUnique({
      where: { id: context.library.id },
      select: { lastBackupAt: true, lastBackupBy: { select: { name: true, email: true } } },
    }),
  ]);

  const lastBackup =
    backupInfo?.lastBackupAt
      ? {
          atLabel: backupInfo.lastBackupAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
          byName: backupInfo.lastBackupBy?.name ?? backupInfo.lastBackupBy?.email ?? "someone no longer in this library",
        }
      : null;

  const canManage = context.membership.role === "OWNER" || context.membership.role === "ADMIN";
  const isOwner = context.membership.role === "OWNER";

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">Settings</h1>
        <p className="font-mono text-[11px] tracking-[.10em] text-ink-soft uppercase">{context.library.name}</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] tracking-[.16em] text-ink-soft uppercase">Shelves</h2>
        <CreateShelfForm />
        <ul className="divide-y divide-line-inner border border-line bg-surface px-4">
          {shelves.map((shelf) => (
            <ShelfManageRow
              key={shelf.id}
              shelf={{ id: shelf.id, name: shelf.name, copyCount: shelf._count.copies }}
            />
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] tracking-[.16em] text-ink-soft uppercase">Members</h2>
        <ul className="divide-y divide-line-inner border border-line bg-surface px-4">
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

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] tracking-[.16em] text-ink-soft uppercase">Backup &amp; Import</h2>
        <BackupImportSection lastBackup={lastBackup} />
      </section>

      {isOwner && (
        <section>
          <DeleteLibraryForm libraryName={context.library.name} />
        </section>
      )}
    </div>
  );
}
