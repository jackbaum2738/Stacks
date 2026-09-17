import { redirect } from "next/navigation";
import { getCurrentLibrary } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CopyRow } from "@/components/copy-row";
import { applyBookOverride } from "@/lib/book-view";

export default async function ReservationsPage() {
  const context = await getCurrentLibrary();
  if (!context) redirect("/login");

  const libraryId = context.library.id;
  const found = await prisma.reservation.findMany({
    where: { releasedAt: null, copy: { libraryId } },
    include: {
      copy: {
        include: {
          book: { include: { overrides: { where: { libraryId } } } },
          shelf: true,
          reservation: { include: { person: true } },
        },
      },
      person: true,
    },
    orderBy: { person: { name: "asc" } },
  });

  const reservations = found.map((reservation) => ({
    ...reservation,
    copy: { ...reservation.copy, book: applyBookOverride(reservation.copy.book, reservation.copy.book.overrides[0]) },
  }));

  // Grouped by person id, not name -- two different people can share a name, and they
  // should never be collapsed into one heading just because the text matches.
  const grouped = new Map<string, { label: string; group: typeof reservations }>();
  for (const reservation of reservations) {
    const key = reservation.personId ?? "unknown";
    const label = reservation.person?.name ?? "Someone no longer in your directory";
    const existing = grouped.get(key);
    if (existing) existing.group.push(reservation);
    else grouped.set(key, { label, group: [reservation] });
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-[32px] font-semibold text-ink">Reservations</h1>

      {reservations.length === 0 ? (
        <p className="font-sans text-sm text-ink-soft">No active reservations.</p>
      ) : (
        Array.from(grouped.entries()).map(([key, { label, group }]) => (
          <div key={key}>
            <h2 className="mb-2 font-display font-semibold text-ink">
              {label} <span className="font-sans text-sm font-normal text-ink-soft">({group.length})</span>
            </h2>
            <ul className="divide-y divide-line-inner border border-line bg-surface px-4">
              {group.map((reservation) => (
                <CopyRow key={reservation.copy.id} copy={reservation.copy} />
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
