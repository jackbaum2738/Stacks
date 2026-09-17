-- AlterEnum
-- Adds the "View Only" tier alongside existing OWNER/ADMIN/MEMBER.
ALTER TYPE "Role" ADD VALUE 'VIEW_ONLY';

-- AlterTable
-- Splits the single invite link into one per grantable role (Admin/Member/View Only --
-- there is never an invite link for Owner; that only ever happens via ownership transfer).
ALTER TABLE "Library" ADD COLUMN     "inviteCodeAdmin" TEXT,
ADD COLUMN     "inviteCodeMember" TEXT,
ADD COLUMN     "inviteCodeViewOnly" TEXT;

-- Preserve any already-shared invite link. Before this migration, accepting the one
-- inviteCode a library had always granted the old full-access MEMBER role (everything
-- short of managing members/invites/deleting the library) -- the closest match today is
-- ADMIN, so an already-shared link keeps working exactly as it did.
UPDATE "Library" SET "inviteCodeAdmin" = "inviteCode" WHERE "inviteCode" IS NOT NULL;

-- DropIndex
DROP INDEX "Library_inviteCode_key";

-- AlterTable
ALTER TABLE "Library" DROP COLUMN "inviteCode";

-- CreateIndex
CREATE UNIQUE INDEX "Library_inviteCodeAdmin_key" ON "Library"("inviteCodeAdmin");

-- CreateIndex
CREATE UNIQUE INDEX "Library_inviteCodeMember_key" ON "Library"("inviteCodeMember");

-- CreateIndex
CREATE UNIQUE INDEX "Library_inviteCodeViewOnly_key" ON "Library"("inviteCodeViewOnly");

-- Every plain MEMBER today already has the full read/write access ADMIN now represents
-- (this migration is what narrows MEMBER's meaning going forward) -- promote them so
-- nobody's access shrinks the moment this ships. Existing OWNER/ADMIN rows are untouched.
UPDATE "Membership" SET "role" = 'ADMIN' WHERE "role" = 'MEMBER';
