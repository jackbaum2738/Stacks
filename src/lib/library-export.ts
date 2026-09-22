import { prisma } from "@/lib/prisma";
import { applyBookOverride } from "@/lib/book-view";

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  REMOVED: "Removed",
};

function formatBirthday(birthday: Date | null): string {
  return birthday ? birthday.toISOString().slice(0, 10) : "";
}

/** Row builder shared by the full backup, the books-only export, and the import template. */
export async function buildBookExportRows(libraryId: string): Promise<(string | number | null)[][]> {
  const copies = await prisma.copy.findMany({
    where: { libraryId, status: { not: "REMOVED" } },
    include: {
      book: { include: { overrides: { where: { libraryId } } } },
      shelf: true,
      reservation: { include: { person: true } },
    },
    orderBy: { addedAt: "asc" },
  });

  return copies.map((copy) => {
    const book = applyBookOverride(copy.book, copy.book.overrides[0]);
    return [
      copy.code,
      copy.book.isbn13,
      book.title,
      book.authors.join("; "),
      book.publisher,
      copy.shelf?.name ?? "",
      STATUS_LABEL[copy.status] ?? copy.status,
      copy.reservation?.person?.name ?? "",
      copy.reservation?.person?.code ?? "",
      copy.notes,
      copy.bookCrossingId,
      copy.addedAt.toISOString().slice(0, 10),
    ];
  });
}

/** Row builder shared by the full backup and the people-only export. */
export async function buildPeopleExportRows(libraryId: string): Promise<(string | number | null)[][]> {
  const people = await prisma.person.findMany({ where: { libraryId }, orderBy: { name: "asc" } });

  return people.map((person) => [
    person.code,
    person.name,
    person.email ?? "",
    person.phone ?? "",
    person.location ?? "",
    formatBirthday(person.birthday),
  ]);
}
