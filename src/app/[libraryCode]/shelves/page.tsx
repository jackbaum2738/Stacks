import Link from "next/link";
import { redirect } from "next/navigation";
import { getLibraryByCode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageLibrarySettings } from "@/lib/permissions";

export default async function ShelvesPage({ params }: PageProps<"/[libraryCode]/shelves">) {
  const { libraryCode } = await params;
  const context = await getLibraryByCode(libraryCode);
  if (context.status !== "ok") redirect("/login");

  const canManage = canManageLibrarySettings(context.membership.role);

  const shelves = await prisma.shelf.findMany({
    where: { libraryId: context.library.id },
    include: { _count: { select: { copies: { where: { status: { not: "REMOVED" } } } } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[32px] font-semibold text-ink">Shelves</h1>
        {canManage && (
          <Link href={`/${libraryCode}/settings`} className="font-sans text-sm font-medium text-accent">
            Manage shelves
          </Link>
        )}
      </div>

      {shelves.length === 0 ? (
        <p className="font-sans text-sm text-ink-soft">
          {canManage ? (
            <>
              No shelves yet.{" "}
              <Link href={`/${libraryCode}/settings`} className="text-accent">
                Add one
              </Link>{" "}
              to get started.
            </>
          ) : (
            "No shelves yet."
          )}
        </p>
      ) : (
        <ul className="divide-y divide-line-inner border border-line bg-surface px-4">
          {shelves.map((shelf) => (
            <li key={shelf.id}>
              <Link
                href={`/${libraryCode}/shelves/${shelf.id}`}
                className="flex items-center justify-between py-3 font-sans text-ink hover:text-accent"
              >
                <span className="font-display font-medium">{shelf.name}</span>
                <span className="font-mono text-sm text-ink-soft">
                  {shelf._count.copies} {shelf._count.copies === 1 ? "book" : "books"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
