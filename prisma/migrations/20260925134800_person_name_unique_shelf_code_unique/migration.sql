-- Person.name becomes the unique field per library (duplicate names are now blocked); email
-- no longer has to be unique, since two people can now legitimately share one email address.
-- DropIndex
DROP INDEX "Person_libraryId_email_key";

-- CreateIndex
CREATE UNIQUE INDEX "Person_libraryId_name_key" ON "Person"("libraryId", "name");

-- Shelf.code (when set) must now also be unique per library, alongside the existing name check.
-- CreateIndex
CREATE UNIQUE INDEX "Shelf_libraryId_code_key" ON "Shelf"("libraryId", "code");
