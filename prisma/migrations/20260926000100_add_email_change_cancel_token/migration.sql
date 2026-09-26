-- Any in-flight (unconfirmed) email change requests predate the second cancel token and can't
-- carry one -- deleting them just means that one pending request has to be re-sent from the
-- Profile page; nothing else is affected.
DELETE FROM "EmailChangeRequest";

-- AlterTable
ALTER TABLE "EmailChangeRequest" ADD COLUMN "cancelTokenHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "EmailChangeRequest_cancelTokenHash_key" ON "EmailChangeRequest"("cancelTokenHash");
