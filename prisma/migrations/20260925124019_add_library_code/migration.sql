-- Add the "code" column nullable first so this works against a table with existing rows
-- (Jack's real libraries), then backfill a unique "L-XXXXXX" code for every row that doesn't
-- have one yet, then tighten to NOT NULL + UNIQUE -- same shape as the User.username migration
-- (see CLAUDE.md's "Usernames and profile" note), except done in one migration since nothing
-- depends on the column existing in between.
ALTER TABLE "Library" ADD COLUMN "code" TEXT;

DO $$
DECLARE
  chars TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  lib RECORD;
  new_code TEXT;
  attempt INT;
  i INT;
BEGIN
  FOR lib IN SELECT id FROM "Library" WHERE "code" IS NULL LOOP
    attempt := 0;
    LOOP
      new_code := 'L-';
      FOR i IN 1..6 LOOP
        new_code := new_code || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
      END LOOP;
      attempt := attempt + 1;
      EXIT WHEN attempt > 20 OR NOT EXISTS (SELECT 1 FROM "Library" WHERE "code" = new_code);
    END LOOP;
    UPDATE "Library" SET "code" = new_code WHERE id = lib.id;
  END LOOP;
END $$;

ALTER TABLE "Library" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "Library_code_key" ON "Library"("code");
