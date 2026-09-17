-- AlterTable
-- Follow-up to 20260917202151_add_user_username: the two real accounts that predated
-- usernames have both had one set by hand from the new Profile page, so the column can
-- now become required. See CLAUDE.md's "Usernames and profile" note.
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
