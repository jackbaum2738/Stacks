import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

export async function uniqueSlug(libraryName: string) {
  const baseSlug = slugify(libraryName) || "library";
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.library.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
  return slug;
}

/** Creates a new library (with a default shelf) owned by the given user. */
export async function createLibraryForUser(userId: string, libraryName: string) {
  const slug = await uniqueSlug(libraryName);
  return prisma.library.create({
    data: {
      name: libraryName,
      slug,
      shelves: { create: [{ name: "Unsorted" }] },
      memberships: { create: { userId, role: "OWNER" } },
    },
  });
}
