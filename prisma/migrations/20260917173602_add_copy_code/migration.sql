-- AlterTable
ALTER TABLE "Copy" ADD COLUMN "code" TEXT;

-- Backfill existing copies with a random "C-XXXXXX" code, unique per library. Uses the
-- same charset/format src/lib/copy-code.ts generates going forward (excludes 0/O/1/I/L
-- to avoid visually-confusing characters).
DO $$
DECLARE
  chars TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  copy_row RECORD;
  new_code TEXT;
  i INT;
BEGIN
  FOR copy_row IN SELECT "id", "libraryId" FROM "Copy" LOOP
    LOOP
      new_code := 'C-';
      FOR i IN 1..6 LOOP
        new_code := new_code || substr(chars, floor(random() * length(chars))::int + 1, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM "Copy" WHERE "libraryId" = copy_row."libraryId" AND "code" = new_code
      );
    END LOOP;
    UPDATE "Copy" SET "code" = new_code WHERE "id" = copy_row."id";
  END LOOP;
END $$;

-- AlterTable
ALTER TABLE "Copy" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Copy_libraryId_code_key" ON "Copy"("libraryId", "code");
