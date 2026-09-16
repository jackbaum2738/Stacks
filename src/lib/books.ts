import { cleanIsbn, toIsbn13 } from "@/lib/isbn";

/**
 * How many times someone can click "look up this ISBN" on a still-unresolved book before
 * the button stops being offered. Deliberately separate from (and doesn't limit) the
 * automatic retry scan-in already does on every future scan of an unresolved ISBN, since
 * that only ever fires once per real physical scan and can't be spammed the way a button
 * click can.
 */
export const MAX_MANUAL_LOOKUP_ATTEMPTS = 1;

export interface BookLookupResult {
  isbn13: string;
  isbn10: string | null;
  title: string;
  authors: string[];
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  description: string | null;
  coverUrl: string | null;
  source: string;
}

const OPEN_LIBRARY_HEADERS = {
  "User-Agent": `Stacks/1.0 (${process.env.OPEN_LIBRARY_CONTACT ?? "contact@example.com"})`,
};

async function fetchJson(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.error(`[books] ${url} responded ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[books] fetch failed for ${url}:`, err);
    return null;
  }
}

async function lookupGoogleBooks(isbn: string) {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${key ? `&key=${key}` : ""}`;
  const data = await fetchJson(url);
  const info = data?.items?.[0]?.volumeInfo;
  if (!info) return null;

  return {
    title: (info.title as string) ?? null,
    authors: (info.authors as string[]) ?? null,
    description: (info.description as string) ?? null,
    publisher: (info.publisher as string) ?? null,
    publishedDate: (info.publishedDate as string) ?? null,
    pageCount: (info.pageCount as number) ?? null,
    coverUrl: info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null,
  };
}

async function lookupOpenLibraryAuthorName(authorKey: string): Promise<string | null> {
  const authorId = authorKey.split("/").pop();
  if (!authorId) return null;
  const data = await fetchJson(`https://openlibrary.org/authors/${authorId}.json`, {
    headers: OPEN_LIBRARY_HEADERS,
  });
  return data?.name ?? null;
}

function extractDescription(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "value" in value) {
    return (value as { value?: string }).value ?? null;
  }
  return null;
}

async function lookupOpenLibrary(isbn: string, needAuthors: boolean) {
  const book = await fetchJson(`https://openlibrary.org/isbn/${isbn}.json`, {
    headers: OPEN_LIBRARY_HEADERS,
  });
  if (!book) return null;

  let authors: string[] | null = null;
  if (needAuthors && Array.isArray(book.authors) && book.authors[0]?.key) {
    const name = await lookupOpenLibraryAuthorName(book.authors[0].key);
    if (name) authors = [name];
  }

  let description = extractDescription(book.description);
  if (!description && Array.isArray(book.works) && book.works[0]?.key) {
    const workId = book.works[0].key.split("/").pop();
    const work = await fetchJson(`https://openlibrary.org/works/${workId}.json`, {
      headers: OPEN_LIBRARY_HEADERS,
    });
    description = extractDescription(work?.description);
  }

  return {
    title: book.title ?? null,
    authors,
    description,
    publisher: Array.isArray(book.publishers) ? book.publishers[0] : null,
    publishedDate: book.publish_date ?? null,
    pageCount: book.number_of_pages ?? null,
    coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
  };
}

/**
 * Looks up a book by ISBN using Google Books first, then fills any gaps
 * (title/authors/description/cover) from Open Library, mirroring the
 * cascading lookup from the original Apps Script.
 */
export async function lookupBookByIsbn(rawIsbn: string): Promise<BookLookupResult | null> {
  const isbn = cleanIsbn(rawIsbn);
  const isbn13 = toIsbn13(isbn);

  const google = await lookupGoogleBooks(isbn13);

  const needsFallback =
    !google || !google.title || !google.authors || !google.description || !google.coverUrl;

  const openLibrary = needsFallback
    ? await lookupOpenLibrary(isbn13, !google?.authors)
    : null;

  const title = google?.title ?? openLibrary?.title;
  if (!title) return null;

  return {
    isbn13,
    isbn10: isbn.length === 10 ? isbn : null,
    title,
    authors: google?.authors ?? openLibrary?.authors ?? [],
    publisher: google?.publisher ?? openLibrary?.publisher ?? null,
    publishedDate: google?.publishedDate ?? openLibrary?.publishedDate ?? null,
    pageCount: google?.pageCount ?? openLibrary?.pageCount ?? null,
    description: google?.description ?? openLibrary?.description ?? null,
    coverUrl: google?.coverUrl ?? openLibrary?.coverUrl ?? null,
    source: google ? (openLibrary ? "google-books+open-library" : "google-books") : "open-library",
  };
}
