import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLibraryByCode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EditBookForm } from "@/components/edit-book-form";
import { applyBookOverride } from "@/lib/book-view";
import { canEditLibrary } from "@/lib/permissions";

export default async function EditBookPage(props: PageProps<"/[libraryCode]/copies/[id]/edit">) {
  const { libraryCode, id } = await props.params;
  const context = await getLibraryByCode(libraryCode);
  if (context.status !== "ok") redirect("/login");
  const libraryId = context.library.id;
  if (!canEditLibrary(context.membership.role)) redirect(`/${libraryCode}/copies/${id}`);

  const copy = await prisma.copy.findFirst({
    where: { id, libraryId, status: { not: "REMOVED" } },
    include: { book: { include: { overrides: { where: { libraryId } } } } },
  });
  if (!copy) notFound();

  const book = applyBookOverride(copy.book, copy.book.overrides[0]);

  return (
    <div className="space-y-6">
      <Link
        href={`/${libraryCode}/copies/${copy.id}`}
        className="inline-flex items-center gap-1 font-mono text-[12px] tracking-[.10em] text-accent uppercase hover:underline"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-[14px] w-[14px]">
          <path d="M12.5 15.5 7 10l5.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {book.title}
      </Link>
      <EditBookForm
        copyId={copy.id}
        code={libraryCode}
        book={book}
        bookCrossingId={copy.bookCrossingId}
        unresolved={copy.book.source === "manual-unresolved"}
        manualLookupAttempts={copy.book.manualLookupAttempts}
      />
    </div>
  );
}
