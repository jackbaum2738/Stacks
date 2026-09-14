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
          reservation: true,
        },
      },
    },
    orderBy: { reservedFor: "asc" },
  });

  const reservations = found.map((reservation) => ({
    ...reservation,
    copy: { ...reservation.copy, book: applyBookOverride(reservation.copy.book, reservation.copy.book.overrides[0]) },
  }));

  const grouped = new Map<string, typeof reservations>();
  for (const reservation of reservations) {
    const key = reservation.reservedFor;
    grouped.set(key, [...(grouped.get(key) ?? []), reservation]);
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-[32px] font-semibold text-ink">Reservations</h1>

      {reservations.length === 0 ? (
        <p className="font-sans text-sm text-ink-soft">No active reservations.</p>
      ) : (
        Array.from(grouped.entries()).map(([reservedFor, group]) => (
          <div key={reservedFor}>
            <h2 className="mb-2 font-display font-semibold text-ink">
              {reservedFor}{" "}
              <span className="font-sans text-sm font-normal text-ink-soft">({group.length})</span>
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
