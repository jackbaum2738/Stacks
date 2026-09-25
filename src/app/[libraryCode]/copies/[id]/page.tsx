import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLibraryByCode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CopyDetail } from "@/components/copy-detail";
import { applyBookOverride } from "@/lib/book-view";

export default async function CopyDetailPage(props: PageProps<"/[libraryCode]/copies/[id]">) {
  const { libraryCode, id } = await props.params;
  const context = await getLibraryByCode(libraryCode);
  if (context.status !== "ok") redirect("/login");

  const found = await prisma.copy.findFirst({
    where: { id, libraryId: context.library.id, status: { not: "REMOVED" } },
    include: {
      book: { include: { overrides: { where: { libraryId: context.library.id } } } },
      shelf: true,
      reservation: { include: { person: true } },
    },
  });
  if (!found) notFound();

  const copy = { ...found, book: applyBookOverride(found.book, found.book.overrides[0]) };

  return (
    <div className="space-y-6">
      <Link
        href={`/${libraryCode}/library`}
        className="inline-flex items-center gap-1 font-mono text-[12px] tracking-[.10em] text-accent uppercase hover:underline"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-[14px] w-[14px]">
          <path d="M12.5 15.5 7 10l5.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Library
      </Link>
      <CopyDetail copy={copy} code={libraryCode} libraryName={context.library.name} />
    </div>
  );
}
