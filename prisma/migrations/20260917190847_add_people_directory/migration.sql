-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "birthday" TIMESTAMP(3),
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Person_libraryId_idx" ON "Person"("libraryId");

-- CreateIndex
CREATE UNIQUE INDEX "Person_libraryId_code_key" ON "Person"("libraryId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Person_libraryId_email_key" ON "Person"("libraryId", "email");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add the new column nullable first so existing rows can be backfilled below
-- before reservedFor/contact are dropped.
ALTER TABLE "Reservation" ADD COLUMN "personId" TEXT;

-- Backfill: one Person per distinct (library, reservedFor name) pair that any existing
-- Reservation currently points at -- not per-row, since several copies can already be
-- reserved for the same name and those should collapse onto a single Person, the way the
-- old "distinct reservedFor" autocomplete already treated them as one person. `contact`
-- was a freeform "email or note" field; it only carries over into Person.email when it
-- actually looks like one, since Person.email is a real unique column now, not free text.
DO $$
DECLARE
  chars TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  grp RECORD;
  new_id TEXT;
  new_code TEXT;
  matched_email TEXT;
  i INT;
BEGIN
  FOR grp IN
    SELECT DISTINCT c."libraryId" AS library_id, r."reservedFor" AS person_name
    FROM "Reservation" r
    JOIN "Copy" c ON c."id" = r."copyId"
  LOOP
    SELECT r2."contact" INTO matched_email
    FROM "Reservation" r2
    JOIN "Copy" c2 ON c2."id" = r2."copyId"
    WHERE c2."libraryId" = grp.library_id
      AND r2."reservedFor" = grp.person_name
      AND r2."contact" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    LIMIT 1;

    LOOP
      new_code := 'P-';
      FOR i IN 1..6 LOOP
        new_code := new_code || substr(chars, floor(random() * length(chars))::int + 1, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM "Person" WHERE "libraryId" = grp.library_id AND "code" = new_code
      );
    END LOOP;

    new_id := md5(random()::text || clock_timestamp()::text || grp.person_name);

    INSERT INTO "Person" ("id", "libraryId", "name", "email", "code", "createdAt")
    VALUES (new_id, grp.library_id, grp.person_name, matched_email, new_code, now());

    UPDATE "Reservation" r3
    SET "personId" = new_id
    FROM "Copy" c3
    WHERE c3."id" = r3."copyId"
      AND c3."libraryId" = grp.library_id
      AND r3."reservedFor" = grp.person_name;

    matched_email := NULL;
  END LOOP;
END $$;

-- AlterTable: drop the old freeform columns now that every existing row has a personId.
ALTER TABLE "Reservation" DROP COLUMN "contact",
DROP COLUMN "reservedFor";

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
