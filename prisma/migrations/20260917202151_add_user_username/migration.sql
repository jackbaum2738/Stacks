-- AlterTable
-- Nullable for now -- the accounts that predate usernames need one set by hand (from the new
-- Profile page) before a follow-up migration can make this NOT NULL. See CLAUDE.md.
ALTER TABLE "User" ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
