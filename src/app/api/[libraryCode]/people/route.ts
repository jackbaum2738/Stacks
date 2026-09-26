import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { generateUniquePersonCode } from "@/lib/person-code";

/** The whole directory -- small enough per library that search/sort happen client-side, same as the Library page. */
export async function GET(_request: Request, { params }: RouteContext<"/api/[libraryCode]/people">) {
  const { libraryCode } = await params;
  const { context, response } = await requireLibraryContext(libraryCode);
  if (!context) return response;

  const people = await prisma.person.findMany({
    where: { libraryId: context.library.id },
    include: {
      _count: { select: { reservations: { where: { releasedAt: null } } } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    people: people.map(({ _count, ...person }) => ({ ...person, activeReservationCount: _count.reservations })),
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().max(200).email().optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional(),
  location: z.string().trim().max(200).optional(),
  birthday: z.string().trim().optional(), // yyyy-mm-dd
});

export async function POST(request: Request, { params }: RouteContext<"/api/[libraryCode]/people">) {
  const { libraryCode } = await params;
  const { context, response } = await requireLibraryContext(libraryCode, { require: "edit" });
  if (!context) return response;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue?.message ?? "Invalid input", field: issue?.path[0] }, { status: 400 });
  }

  const { name, phone, location, birthday } = parsed.data;
  const email = parsed.data.email ? parsed.data.email.toLowerCase() : null;

  const clash = await prisma.person.findFirst({ where: { libraryId: context.library.id, name } });
  if (clash) {
    return NextResponse.json(
      { error: `A person named "${clash.name}" already exists`, field: "name", conflictingPersonId: clash.id },
      { status: 409 }
    );
  }

  const code = await generateUniquePersonCode(prisma, context.library.id);
  const person = await prisma.person.create({
    data: {
      libraryId: context.library.id,
      name,
      email,
      phone: phone || null,
      location: location || null,
      birthday: birthday ? new Date(birthday) : null,
      code,
    },
  });

  return NextResponse.json({ person: { ...person, activeReservationCount: 0 } }, { status: 201 });
}
