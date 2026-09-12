-- AlterTable
ALTER TABLE "Library" ADD COLUMN "inviteCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Library_inviteCode_key" ON "Library"("inviteCode");
