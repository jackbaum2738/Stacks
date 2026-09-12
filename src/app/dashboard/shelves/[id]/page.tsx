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
        <Link href="/dashboard/shelves" className="text-sm text-gray-500 hover:underline">
          ← All shelves
        </Link>
        <h1 className="text-2xl font-bold">{shelf.name}</h1>
        <p className="text-sm text-gray-500">
          {shelf.copies.length} {shelf.copies.length === 1 ? "book" : "books"}
        </p>
      </div>

      {shelf.copies.length === 0 ? (
        <p className="text-sm text-gray-500">No books on this shelf yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-800">
          {shelf.copies.map((copy) => (
            <CopyRow key={copy.id} copy={copy} showShelf={false} />
          ))}
        </ul>
      )}
    </div>
  );
}
