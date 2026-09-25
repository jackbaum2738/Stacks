import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLibraryByCode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CopyRow } from "@/components/copy-row";
import { applyBookOverride } from "@/lib/book-view";

export default async function ShelfDetailPage(props: PageProps<"/[libraryCode]/shelves/[id]">) {
  const { libraryCode, id } = await props.params;
  const context = await getLibraryByCode(libraryCode);
  if (context.status !== "ok") redirect("/login");

  const libraryId = context.library.id;
  const found = await prisma.shelf.findFirst({
    where: { id, libraryId },
    include: {
      copies: {
        where: { status: { not: "REMOVED" } },
        include: {
          book: { include: { overrides: { where: { libraryId } } } },
          shelf: true,
          reservation: { include: { person: true } },
        },
        orderBy: { addedAt: "desc" },
      },
    },
  });
  if (!found) notFound();

  const shelf = {
    ...found,
    copies: found.copies.map((copy) => ({ ...copy, book: applyBookOverride(copy.book, copy.book.overrides[0]) })),
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/${libraryCode}/shelves`} className="font-mono text-[12px] tracking-[.10em] text-accent uppercase hover:underline">
          ← All shelves
        </Link>
        <h1 className="font-display text-[32px] font-semibold text-ink">{shelf.name}</h1>
        <p className="font-mono text-[11px] tracking-[.10em] text-ink-soft uppercase">
          {shelf.copies.length} {shelf.copies.length === 1 ? "book" : "books"}
        </p>
      </div>

      {shelf.copies.length === 0 ? (
        <p className="font-sans text-sm text-ink-soft">No books on this shelf yet.</p>
      ) : (
        <ul className="divide-y divide-line-inner border border-line bg-surface px-4">
          {shelf.copies.map((copy) => (
            <CopyRow key={copy.id} copy={copy} code={libraryCode} showShelf={false} />
          ))}
        </ul>
      )}
    </div>
  );
}
