import { redirect } from "next/navigation";
import { getLibraryByCode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ShelvesSection } from "@/components/shelves-section";
import { MembersSection } from "@/components/members-section";
import { DangerZoneSection } from "@/components/danger-zone-section";
import { BackupImportSection } from "@/components/backup-import-section";
import { canEditLibrary, canManageLibrarySettings, isOwner } from "@/lib/permissions";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default async function SettingsPage({ params }: PageProps<"/[libraryCode]/settings">) {
  const { libraryCode } = await params;
  const context = await getLibraryByCode(libraryCode);
  if (context.status !== "ok") redirect("/login");

  const canManage = canManageLibrarySettings(context.membership.role);
  const canImport = canManage; // Admin+ only -- Member is excluded so they can't create shelves indirectly via import.
  const canExport = canEditLibrary(context.membership.role); // View Only excluded -- export writes a lastBackup marker.
  const ownerIsMe = isOwner(context.membership.role);
  const showDangerZone = canManage || ownerIsMe; // canManage (Admin+) can empty; only Owner can delete.

  const [shelves, members, invites, backupInfo, emptyCounts] = await Promise.all([
    prisma.shelf.findMany({
      where: { libraryId: context.library.id },
      include: { _count: { select: { copies: { where: { status: { not: "REMOVED" } } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.membership.findMany({
      where: { libraryId: context.library.id },
      include: { user: { select: { id: true, name: true, email: true, username: true } } },
      // Role enum is declared OWNER/ADMIN/MEMBER/VIEW_ONLY in schema.prisma, and Postgres native
      // enums sort by that declaration order, not alphabetically -- so `role: "asc"` already
      // gives Owner -> Admin -> Member -> View Only for free.
      orderBy: [{ role: "asc" }, { user: { username: "asc" } }],
    }),
    canManage
      ? prisma.libraryInvite.findMany({ where: { libraryId: context.library.id }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
    prisma.library.findUnique({
      where: { id: context.library.id },
      select: { lastBackupAt: true, lastBackupBy: { select: { name: true, email: true } } },
    }),
    showDangerZone && canManage
      ? Promise.all([
          prisma.copy.count({ where: { libraryId: context.library.id } }),
          prisma.reservation.count({ where: { releasedAt: null, copy: { libraryId: context.library.id } } }),
        ]).then(([books, reservations]) => ({ books, reservations }))
      : Promise.resolve(null),
  ]);

  const lastBackup =
    backupInfo?.lastBackupAt
      ? {
          atLabel: backupInfo.lastBackupAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
          byName: backupInfo.lastBackupBy?.name ?? backupInfo.lastBackupBy?.email ?? "someone no longer in this library",
        }
      : null;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-[32px] font-semibold text-ink">Settings</h1>
        <p className="font-mono text-[11px] tracking-[.10em] text-ink-soft uppercase">{context.library.name}</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] tracking-[.16em] text-ink-soft uppercase">Appearance</h2>
        <div className="flex flex-wrap items-center justify-between gap-4 border border-line bg-surface px-4 py-4">
          <div>
            <p className="text-[14.5px] font-medium text-ink">Theme</p>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              Choose how Stacks looks on this device. System follows this device&apos;s setting.
            </p>
          </div>
          <ThemeSwitcher />
        </div>
      </section>

      {canManage && (
        <section className="space-y-3">
          <h2 className="font-mono text-[11px] tracking-[.16em] text-ink-soft uppercase">Shelves</h2>
          <ShelvesSection
            code={libraryCode}
            shelves={shelves.map((shelf) => ({ id: shelf.id, name: shelf.name, code: shelf.code, copyCount: shelf._count.copies }))}
          />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] tracking-[.16em] text-ink-soft uppercase">Members</h2>
        <MembersSection
          code={libraryCode}
          members={members.map((m) => ({ id: m.id, userId: m.userId, role: m.role, user: m.user }))}
          canManage={canManage}
          isOwnerViewer={ownerIsMe}
          selfUserId={context.user.id}
          initialInvites={invites.map((i) => ({
            id: i.id,
            email: i.email,
            role: i.role as "ADMIN" | "MEMBER" | "VIEW_ONLY",
            createdAt: i.createdAt.toISOString(),
            lastSentAt: i.lastSentAt.toISOString(),
          }))}
        />
      </section>

      {(canImport || canExport) && (
        <section className="space-y-3">
          <h2 className="font-mono text-[11px] tracking-[.16em] text-ink-soft uppercase">Backup &amp; Import</h2>
          <BackupImportSection code={libraryCode} lastBackup={lastBackup} canImport={canImport} canExport={canExport} />
        </section>
      )}

      {showDangerZone && (
        <section className="space-y-3">
          <h2 className="font-mono text-[11px] tracking-[.16em] text-ink-soft uppercase">Danger zone</h2>
          <DangerZoneSection
            code={libraryCode}
            libraryName={context.library.name}
            canEmpty={canManage}
            canDelete={ownerIsMe}
            emptyCounts={emptyCounts}
          />
        </section>
      )}
    </div>
  );
}
