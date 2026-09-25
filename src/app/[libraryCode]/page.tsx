import Link from "next/link";
import { redirect } from "next/navigation";
import { getLibraryByCode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookCover } from "@/components/book-cover";
import { StatusPill } from "@/components/status-pill";
import { applyBookOverride } from "@/lib/book-view";
import { canEditLibrary } from "@/lib/permissions";

export default async function DashboardPage({ params }: PageProps<"/[libraryCode]">) {
  const { libraryCode } = await params;
  const context = await getLibraryByCode(libraryCode);
  if (context.status !== "ok") redirect("/login");

  const libraryId = context.library.id;

  const [availableCount, reservedCount, shelfCount, recentCopies] = await Promise.all([
    prisma.copy.count({ where: { libraryId, status: "AVAILABLE" } }),
    prisma.copy.count({ where: { libraryId, status: "RESERVED" } }),
    prisma.shelf.count({ where: { libraryId } }),
    prisma.copy.findMany({
      where: { libraryId, status: { not: "REMOVED" } },
      include: { book: { include: { overrides: { where: { libraryId } } } }, shelf: true },
      orderBy: { addedAt: "desc" },
      take: 8,
    }),
  ]);

  const recent = recentCopies.map((copy) => ({
    ...copy,
    book: applyBookOverride(copy.book, copy.book.overrides[0]),
  }));

  return (
    <div className="space-y-[26px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[.14em] text-ink-soft uppercase">Library</p>
          <h1 className="font-display text-[36px] font-semibold text-ink">{context.library.name}</h1>
          <p className="mt-1 font-sans text-[15px] text-ink-soft">
            {availableCount + reservedCount} books on {shelfCount} shelves.
          </p>
        </div>
        <div className="flex gap-3">
          {canEditLibrary(context.membership.role) && (
            <Link
              href={`/${libraryCode}/scan`}
              className="rounded-[2px] bg-accent px-5 py-[11px] font-sans text-[15px] font-medium text-on-accent hover:brightness-95"
            >
              Scan a book
            </Link>
          )}
          <Link
            href={`/${libraryCode}/library`}
            className="rounded-[2px] border border-ink px-5 py-[11px] font-sans text-[15px] font-medium text-ink hover:bg-chip-hover"
          >
            Browse library
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-[14px]">
        <Stat label="Available" value={availableCount} valueClassName="text-ok" />
        <Stat label="Reserved" value={reservedCount} valueClassName="text-accent" />
        <Stat label="Shelves" value={shelfCount} valueClassName="text-accent-2" />
      </div>

      <div>
        <h2 className="mb-3 font-mono text-[11px] tracking-[.16em] text-ink-soft uppercase">
          Recently added
        </h2>
        {recent.length === 0 ? (
          <p className="font-sans text-sm text-ink-soft">
            No books yet — scan your first one to get started.
          </p>
        ) : (
          <ul className="border border-line bg-surface">
            {recent.map((copy, i) => (
              <li
                key={copy.id}
                className={`flex items-center gap-[14px] px-4 py-3 ${
                  i > 0 ? "border-t border-line-inner" : ""
                }`}
              >
                <BookCover
                  src={copy.book.coverUrl}
                  alt={copy.book.title}
                  className="h-[54px] w-[37px] flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[17px] font-medium text-ink">
                    {copy.book.title}
                  </p>
                  <p className="truncate font-sans text-[13px] text-ink-soft">
                    {copy.book.authors.join(", ") || "Unknown author"} · {copy.shelf?.name ?? "No shelf"}
                  </p>
                </div>
                <StatusPill status={copy.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: number;
  valueClassName: string;
}) {
  return (
    <div className="paper-shadow-sm border border-line bg-surface px-[18px] py-4">
      <p className="font-mono text-[10px] tracking-[.14em] text-ink-soft uppercase">{label}</p>
      <p className={`font-display text-[34px] font-semibold ${valueClassName}`}>{value}</p>
    </div>
  );
}
