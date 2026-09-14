export interface BookFields {
  title: string;
  authors: string[];
  publisher: string | null;
  pageCount: number | null;
  description: string | null;
  coverUrl: string | null;
}

export interface BookOverrideFields {
  title: string | null;
  authors: string[];
  publisher: string | null;
  pageCount: number | null;
  description: string | null;
  coverUrl: string | null;
}

/**
 * Merges a library's local corrections (if any) over a Book's shared catalog fields. An
 * override's null fields (and an empty `authors`) mean "not corrected here" and fall back
 * to the canonical value — see the BookOverride model for why this exists.
 */
export function applyBookOverride<T extends BookFields>(book: T, override?: BookOverrideFields | null): T {
  if (!override) return book;
  return {
    ...book,
    title: override.title ?? book.title,
    authors: override.authors.length ? override.authors : book.authors,
    publisher: override.publisher ?? book.publisher,
    pageCount: override.pageCount ?? book.pageCount,
    description: override.description ?? book.description,
    coverUrl: override.coverUrl ?? book.coverUrl,
  };
}
