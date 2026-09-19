-- CreateTable
CREATE TABLE "BookLookupLog" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "isbn13" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "googleBooksCalled" BOOLEAN NOT NULL,
    "googleBooksOutcome" TEXT NOT NULL,
    "googleBooksDetail" TEXT,
    "openLibraryCalled" BOOLEAN NOT NULL,
    "openLibraryOutcome" TEXT,
    "openLibraryDetail" TEXT,
    "resolved" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookLookupLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookLookupLog_libraryId_createdAt_idx" ON "BookLookupLog"("libraryId", "createdAt");

-- AddForeignKey
ALTER TABLE "BookLookupLog" ADD CONSTRAINT "BookLookupLog_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;
