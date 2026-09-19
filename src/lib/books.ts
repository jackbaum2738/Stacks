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

export type LookupOutcome = "success" | "no-match" | "http-error" | "network-error";

/** Per-provider diagnostics for one lookup attempt, meant to be persisted via BookLookupLog. */
export interface ProviderAttempt {
  called: boolean;
  outcome: LookupOutcome | null;
  detail: string | null;
}

export interface LookupDiagnostics {
  googleBooks: ProviderAttempt;
  openLibrary: ProviderAttempt;
}

const OPEN_LIBRARY_HEADERS = {
  "User-Agent": `Stacks/1.0 (${process.env.OPEN_LIBRARY_CONTACT ?? "contact@example.com"})`,
};

interface FetchResult {
  data: unknown;
  outcome: LookupOutcome;
  detail: string | null;
}

async function fetchJson(url: string, init?: RequestInit): Promise<FetchResult> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.error(`[books] ${url} responded ${res.status}`);
      return { data: null, outcome: "http-error", detail: `HTTP ${res.status}` };
    }
    return { data: await res.json(), outcome: "success", detail: null };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[books] fetch failed for ${url}:`, err);
    return { data: null, outcome: "network-error", detail };
  }
}

interface GoogleBooksData {
  title: string | null;
  authors: string[] | null;
  description: string | null;
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  coverUrl: string | null;
}

async function lookupGoogleBooks(
  isbn: string
): Promise<{ result: GoogleBooksData | null } & ProviderAttempt> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${key ? `&key=${key}` : ""}`;
  const { data, outcome, detail } = await fetchJson(url);
  if (outcome !== "success") return { result: null, called: true, outcome, detail };

  const info = (data as { items?: Array<{ volumeInfo?: Record<string, unknown> }> })?.items?.[0]
    ?.volumeInfo;
  if (!info) return { result: null, called: true, outcome: "no-match", detail: null };

  return {
    result: {
      title: (info.title as string) ?? null,
      authors: (info.authors as string[]) ?? null,
      description: (info.description as string) ?? null,
      publisher: (info.publisher as string) ?? null,
      publishedDate: (info.publishedDate as string) ?? null,
      pageCount: (info.pageCount as number) ?? null,
      coverUrl:
        (info.imageLinks as { thumbnail?: string; smallThumbnail?: string } | undefined)
          ?.thumbnail ??
        (info.imageLinks as { thumbnail?: string; smallThumbnail?: string } | undefined)
          ?.smallThumbnail ??
        null,
    },
    called: true,
    outcome: "success",
    detail: null,
  };
}

async function lookupOpenLibraryAuthorName(authorKey: string): Promise<string | null> {
  const authorId = authorKey.split("/").pop();
  if (!authorId) return null;
  const { data } = await fetchJson(`https://openlibrary.org/authors/${authorId}.json`, {
    headers: OPEN_LIBRARY_HEADERS,
  });
  return (data as { name?: string } | null)?.name ?? null;
}

function extractDescription(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "value" in value) {
    return (value as { value?: string }).value ?? null;
  }
  return null;
}

interface OpenLibraryData {
  title: string | null;
  authors: string[] | null;
  description: string | null;
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  coverUrl: string | null;
}

async function lookupOpenLibrary(
  isbn: string,
  needAuthors: boolean
): Promise<{ result: OpenLibraryData | null } & ProviderAttempt> {
  const { data, outcome, detail } = await fetchJson(`https://openlibrary.org/isbn/${isbn}.json`, {
    headers: OPEN_LIBRARY_HEADERS,
  });
  if (outcome !== "success") return { result: null, called: true, outcome, detail };

  const book = data as {
    title?: string;
    authors?: Array<{ key?: string }>;
    description?: unknown;
    publishers?: string[];
    publish_date?: string;
    number_of_pages?: number;
    works?: Array<{ key?: string }>;
  };

  const needsAuthorLookup = needAuthors && Array.isArray(book.authors) && !!book.authors[0]?.key;
  let description = extractDescription(book.description);
  const needsWorkLookup = !description && Array.isArray(book.works) && !!book.works[0]?.key;

  const [authorName, workData] = await Promise.all([
    needsAuthorLookup ? lookupOpenLibraryAuthorName(book.authors![0].key!) : Promise.resolve(null),
    needsWorkLookup
      ? fetchJson(`https://openlibrary.org/works/${book.works![0].key!.split("/").pop()}.json`, {
          headers: OPEN_LIBRARY_HEADERS,
        })
      : Promise.resolve(null),
  ]);

  const authors = authorName ? [authorName] : null;
  if (workData) {
    description = extractDescription(
      (workData.data as { description?: unknown } | null)?.description
    );
  }

  return {
    result: {
      title: book.title ?? null,
      authors,
      description,
      publisher: Array.isArray(book.publishers) ? book.publishers[0] : null,
      publishedDate: book.publish_date ?? null,
      pageCount: book.number_of_pages ?? null,
      coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
    },
    called: true,
    outcome: "success",
    detail: null,
  };
}

/**
 * Looks up a book by ISBN using Google Books first, then fills any gaps
 * (title/authors/description/cover) from Open Library, mirroring the
 * cascading lookup from the original Apps Script. Returns diagnostics for
 * each provider actually called, so callers can persist a BookLookupLog row.
 */
export async function lookupBookByIsbn(
  rawIsbn: string
): Promise<{ result: BookLookupResult | null; diagnostics: LookupDiagnostics }> {
  const isbn = cleanIsbn(rawIsbn);
  const isbn13 = toIsbn13(isbn);

  const googleAttempt = await lookupGoogleBooks(isbn13);
  const google = googleAttempt.result;

  const needsFallback =
    !google || !google.title || !google.authors || !google.description || !google.coverUrl;

  const openLibraryAttempt = needsFallback
    ? await lookupOpenLibrary(isbn13, !google?.authors)
    : { result: null, called: false, outcome: null, detail: null };
  const openLibrary = openLibraryAttempt.result;

  const diagnostics: LookupDiagnostics = {
    googleBooks: {
      called: googleAttempt.called,
      outcome: googleAttempt.outcome,
      detail: googleAttempt.detail,
    },
    openLibrary: {
      called: openLibraryAttempt.called,
      outcome: openLibraryAttempt.outcome,
      detail: openLibraryAttempt.detail,
    },
  };

  const title = google?.title ?? openLibrary?.title;
  if (!title) return { result: null, diagnostics };

  return {
    result: {
      isbn13,
      isbn10: isbn.length === 10 ? isbn : null,
      title,
      authors: google?.authors ?? openLibrary?.authors ?? [],
      publisher: google?.publisher ?? openLibrary?.publisher ?? null,
      publishedDate: google?.publishedDate ?? openLibrary?.publishedDate ?? null,
      pageCount: google?.pageCount ?? openLibrary?.pageCount ?? null,
      description: google?.description ?? openLibrary?.description ?? null,
      coverUrl: google?.coverUrl ?? openLibrary?.coverUrl ?? null,
      source: google
        ? openLibrary
          ? "google-books+open-library"
          : "google-books"
        : "open-library",
    },
    diagnostics,
  };
}
