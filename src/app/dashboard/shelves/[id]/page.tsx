import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentLibrary } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CopyRow } from "@/components/copy-row";

export default async function ShelfDetailPage(props: PageProps<"/dashboard/shelves/[id]">) {
  const context = await getCurrentLibrary();
  if (!context) redirect("/login");
  const { id } = await props.params;

  const shelf = await prisma.shelf.findFirst({
    where: { id, libraryId: context.library.id },
    include: {
      copies: {
        where: { status: { not: "REMOVED" } },
        include: { book: true, shelf: true, reservation: true },
        orderBy: { addedAt: "desc" },
      },
    },
  });
  if (!shelf) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/shelves" className="font-mono text-[12px] tracking-[.10em] text-accent uppercase hover:underline">
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
            <CopyRow key={copy.id} copy={copy} showShelf={false} />
          ))}
        </ul>
      )}
    </div>
  );
}
