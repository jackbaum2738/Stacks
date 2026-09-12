import { redirect } from "next/navigation";
import { getCurrentLibrary } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CopyRow } from "@/components/copy-row";

export default async function ReservationsPage() {
  const context = await getCurrentLibrary();
  if (!context) redirect("/login");

  const reservations = await prisma.reservation.findMany({
    where: { releasedAt: null, copy: { libraryId: context.library.id } },
    include: { copy: { include: { book: true, shelf: true, reservation: true } } },
    orderBy: { reservedFor: "asc" },
  });

  const grouped = new Map<string, typeof reservations>();
  for (const reservation of reservations) {
    const key = reservation.reservedFor;
    grouped.set(key, [...(grouped.get(key) ?? []), reservation]);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reservations</h1>

      {reservations.length === 0 ? (
        <p className="text-sm text-gray-500">No active reservations.</p>
      ) : (
        Array.from(grouped.entries()).map(([reservedFor, group]) => (
          <div key={reservedFor}>
            <h2 className="mb-2 font-semibold">
              {reservedFor} <span className="text-sm font-normal text-gray-500">({group.length})</span>
            </h2>
            <ul className="divide-y divide-gray-200 dark:divide-gray-800">
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
