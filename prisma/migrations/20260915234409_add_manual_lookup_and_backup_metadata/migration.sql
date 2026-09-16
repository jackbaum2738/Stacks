-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "manualLookupAttempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Library" ADD COLUMN     "lastBackupAt" TIMESTAMP(3),
ADD COLUMN     "lastBackupByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "Library" ADD CONSTRAINT "Library_lastBackupByUserId_fkey" FOREIGN KEY ("lastBackupByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
