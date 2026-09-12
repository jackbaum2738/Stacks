import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentLibrary } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookCover } from "@/components/book-cover";

export default async function DashboardPage() {
  const context = await getCurrentLibrary();
  if (!context) redirect("/login");

  const libraryId = context.library.id;

  const [availableCount, reservedCount, shelfCount, recentCopies] = await Promise.all([
    prisma.copy.count({ where: { libraryId, status: "AVAILABLE" } }),
    prisma.copy.count({ where: { libraryId, status: "RESERVED" } }),
    prisma.shelf.count({ where: { libraryId } }),
    prisma.copy.findMany({
      where: { libraryId, status: { not: "REMOVED" } },
      include: { book: true, shelf: true },
      orderBy: { addedAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{context.library.name}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {availableCount + reservedCount} books on {shelfCount} shelves.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Available" value={availableCount} />
        <Stat label="Reserved" value={reservedCount} />
        <Stat label="Shelves" value={shelfCount} />
      </div>

      <div className="flex gap-3">
        <Link href="/dashboard/scan" className="rounded-lg bg-gray-900 px-4 py-2 font-medium text-white dark:bg-white dark:text-gray-900">
          Scan a book
        </Link>
        <Link href="/dashboard/search" className="rounded-lg border border-gray-300 px-4 py-2 font-medium dark:border-gray-700">
          Browse library
        </Link>
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Recently added</h2>
        {recentCopies.length === 0 ? (
          <p className="text-sm text-gray-500">No books yet — scan your first one to get started.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {recentCopies.map((copy) => (
              <li key={copy.id} className="flex items-center gap-3 py-3">
                <BookCover src={copy.book.coverUrl} alt={copy.book.title} className="h-14 w-10 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{copy.book.title}</p>
                  <p className="truncate text-sm text-gray-500">
                    {copy.book.authors.join(", ") || "Unknown author"} · {copy.shelf?.name ?? "No shelf"}
                  </p>
                </div>
                <span
                  className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${
                    copy.status === "AVAILABLE"
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  {copy.status === "AVAILABLE" ? "Available" : "Reserved"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 text-center dark:border-gray-800">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
