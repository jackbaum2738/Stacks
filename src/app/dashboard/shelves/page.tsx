import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentLibrary } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateShelfForm } from "@/components/create-shelf-form";

export default async function ShelvesPage() {
  const context = await getCurrentLibrary();
  if (!context) redirect("/login");

  const shelves = await prisma.shelf.findMany({
    where: { libraryId: context.library.id },
    include: { _count: { select: { copies: { where: { status: { not: "REMOVED" } } } } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Shelves</h1>

      <CreateShelfForm />

      <ul className="divide-y divide-gray-200 dark:divide-gray-800">
        {shelves.map((shelf) => (
          <li key={shelf.id}>
            <Link
              href={`/dashboard/shelves/${shelf.id}`}
              className="flex items-center justify-between py-3 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <span className="font-medium">{shelf.name}</span>
              <span className="text-sm text-gray-500">
                {shelf._count.copies} {shelf._count.copies === 1 ? "book" : "books"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
