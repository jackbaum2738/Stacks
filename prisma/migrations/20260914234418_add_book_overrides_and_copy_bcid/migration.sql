-- AlterTable
ALTER TABLE "Copy" ADD COLUMN     "bookCrossingId" TEXT;

-- CreateTable
CREATE TABLE "BookOverride" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "title" TEXT,
    "authors" TEXT[],
    "publisher" TEXT,
    "pageCount" INTEGER,
    "description" TEXT,
    "coverUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookOverride_bookId_libraryId_key" ON "BookOverride"("bookId", "libraryId");

-- AddForeignKey
ALTER TABLE "BookOverride" ADD CONSTRAINT "BookOverride_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookOverride" ADD CONSTRAINT "BookOverride_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;
