/*
  Warnings:

  - You are about to drop the column `inviteCodeAdmin` on the `Library` table. All the data in the column will be lost.
  - You are about to drop the column `inviteCodeMember` on the `Library` table. All the data in the column will be lost.
  - You are about to drop the column `inviteCodeViewOnly` on the `Library` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Library_inviteCodeAdmin_key";

-- DropIndex
DROP INDEX "Library_inviteCodeMember_key";

-- DropIndex
DROP INDEX "Library_inviteCodeViewOnly_key";

-- AlterTable
ALTER TABLE "Library" DROP COLUMN "inviteCodeAdmin",
DROP COLUMN "inviteCodeMember",
DROP COLUMN "inviteCodeViewOnly";

-- CreateTable
CREATE TABLE "LibraryInvite" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "token" TEXT NOT NULL,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LibraryInvite_token_key" ON "LibraryInvite"("token");

-- CreateIndex
CREATE INDEX "LibraryInvite_libraryId_idx" ON "LibraryInvite"("libraryId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryInvite_libraryId_email_key" ON "LibraryInvite"("libraryId", "email");

-- AddForeignKey
ALTER TABLE "LibraryInvite" ADD CONSTRAINT "LibraryInvite_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryInvite" ADD CONSTRAINT "LibraryInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
