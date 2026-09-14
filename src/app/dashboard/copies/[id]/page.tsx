import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentLibrary } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CopyDetail } from "@/components/copy-detail";

export default async function CopyDetailPage(props: PageProps<"/dashboard/copies/[id]">) {
  const context = await getCurrentLibrary();
  if (!context) redirect("/login");
  const { id } = await props.params;

  const copy = await prisma.copy.findFirst({
    where: { id, libraryId: context.library.id, status: { not: "REMOVED" } },
    include: { book: true, shelf: true, reservation: true },
  });
  if (!copy) notFound();

  return (
    <div className="space-y-6">
      <Link href="/dashboard/search" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:underline">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
          <path d="M12.5 15.5 7 10l5.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Library
      </Link>
      <CopyDetail copy={copy} />
    </div>
  );
}
