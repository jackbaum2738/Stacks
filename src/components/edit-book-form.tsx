"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formLabelClass, formInputClass } from "@/lib/form-styles";
import { BookCover } from "@/components/book-cover";
import { MAX_MANUAL_LOOKUP_ATTEMPTS } from "@/lib/books";

interface EditableBook {
  isbn13: string;
  title: string;
  authors: string[];
  publisher: string | null;
  pageCount: number | null;
  description: string | null;
  coverUrl: string | null;
}

interface LookupResult {
  found: boolean;
  alreadyResolved?: boolean;
  manualLookupAttempts?: number;
  book?: EditableBook;
}

export function EditBookForm({
  copyId,
  code,
  book,
  bookCrossingId: initialBookCrossingId,
  unresolved: initiallyUnresolved,
  manualLookupAttempts: initialManualLookupAttempts,
}: {
  copyId: string;
  code: string;
  book: EditableBook;
  bookCrossingId: string | null;
  unresolved: boolean;
  manualLookupAttempts: number;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(book.title);
  const [authors, setAuthors] = useState(book.authors.join(", "));
  const [publisher, setPublisher] = useState(book.publisher ?? "");
  const [pageCount, setPageCount] = useState(book.pageCount?.toString() ?? "");
  const [coverUrl, setCoverUrl] = useState(book.coverUrl ?? "");
  const [bookCrossingId, setBookCrossingId] = useState(initialBookCrossingId ?? "");
  const [description, setDescription] = useState(book.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState(book.coverUrl ?? "");
  const [previewAttempt, setPreviewAttempt] = useState(0);

  const [unresolved, setUnresolved] = useState(initiallyUnresolved);
  const [manualLookupAttempts, setManualLookupAttempts] = useState(initialManualLookupAttempts);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupOutcome, setLookupOutcome] = useState<"found" | "already-resolved" | "not-found" | null>(null);

  function refreshPreview() {
    setPreviewUrl(coverUrl.trim());
    setPreviewAttempt((n) => n + 1);
  }

  async function runLookup() {
    setLookupBusy(true);
    setLookupOutcome(null);
    const res = await fetch(`/api/${code}/copies/${copyId}/book/lookup`, { method: "POST" });
    const data: LookupResult = await res.json().catch(() => ({ found: false }));
    setLookupBusy(false);

    if (!res.ok) {
      setManualLookupAttempts(MAX_MANUAL_LOOKUP_ATTEMPTS);
      setLookupOutcome("not-found");
      return;
    }

    if (data.found && data.book) {
      // A successful lookup -- whether a real catalog match or one already resolved by
      // another copy of the same book -- always wins over whatever was typed here and is
      // already saved server-side, so the fields just reflect that immediately.
      setTitle(data.book.title);
      setAuthors(data.book.authors.join(", "));
      setPublisher(data.book.publisher ?? "");
      setPageCount(data.book.pageCount?.toString() ?? "");
      setDescription(data.book.description ?? "");
      setCoverUrl(data.book.coverUrl ?? "");
      setPreviewUrl(data.book.coverUrl ?? "");
      setPreviewAttempt((n) => n + 1);
      setUnresolved(false);
      setLookupOutcome(data.alreadyResolved ? "already-resolved" : "found");
    } else {
      setManualLookupAttempts(data.manualLookupAttempts ?? MAX_MANUAL_LOOKUP_ATTEMPTS);
      setLookupOutcome("not-found");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/${code}/copies/${copyId}/book`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        authors: authors
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        publisher: publisher.trim() || null,
        pageCount: pageCount.trim() ? Number(pageCount) : null,
        coverUrl: coverUrl.trim() || null,
        bookCrossingId: bookCrossingId.trim() || null,
        description: description.trim() || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setBusy(false);
      return;
    }

    router.push(`/${code}/copies/${copyId}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="paper-shadow-lg space-y-5 border border-line bg-surface p-8"
    >
      <div className="border-b border-line pb-[10px] font-mono text-[11px] tracking-[.14em] text-ink-soft uppercase">
        Editing your library&apos;s view · ISBN {book.isbn13}
      </div>

      <h1 className="font-display text-2xl font-semibold text-ink">Edit book details</h1>
      <p className="-mt-3 font-sans text-sm text-ink-soft">
        These corrections apply everywhere this book appears in your library, but stay private to
        it — other libraries with a copy of this ISBN won&apos;t see your changes. BookCrossing
        ID applies to this physical copy only.
      </p>

      {unresolved && (
        <div className="space-y-2 border border-line-strong bg-bg p-4">
          <div className="flex items-center gap-2 font-sans text-[12.5px] font-semibold tracking-[.02em] text-accent-2 uppercase">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[16px] w-[16px]">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            Not yet identified
          </div>
          <p className="font-sans text-[13.5px] text-ink-soft">
            We couldn&apos;t automatically match this ISBN in our own catalog. Fill in the details
            yourself below, or try an automatic lookup.
          </p>

          {lookupOutcome === null && manualLookupAttempts < MAX_MANUAL_LOOKUP_ATTEMPTS && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={runLookup}
                disabled={lookupBusy}
                className="rounded-[2px] border border-line-strong px-3 py-2 font-sans text-sm font-medium text-ink hover:bg-chip-hover disabled:opacity-50"
              >
                {lookupBusy ? "Looking up…" : "Look up this ISBN"}
              </button>
              <p className="font-mono text-[11px] text-ink-faint">
                1 manual check per copy — Stacks keeps retrying automatically in the background every
                time this copy is scanned, since the catalogs it checks are always adding new titles.
              </p>
            </div>
          )}

          {lookupOutcome === "not-found" && (
            <p className="rounded-[2px] bg-[var(--pill-reserved-bg)] px-3 py-2 font-sans text-[13px] text-[var(--pill-reserved-fg)]">
              We checked Google Books and Open Library and couldn&apos;t find this ISBN. Feel free to
              fill in the details yourself below — we&apos;ll keep trying automatically in the
              background every time this copy is scanned, in case it&apos;s added later.
            </p>
          )}
        </div>
      )}

      {!unresolved && (lookupOutcome === "found" || lookupOutcome === "already-resolved") && (
        <p className="font-sans text-[13px] font-semibold text-ok">
          ✓{" "}
          {lookupOutcome === "already-resolved"
            ? "Already found by another copy — filled in below and saved, no lookup needed."
            : "Found it — filled in below and saved automatically."}
        </p>
      )}

      {error && <p className="rounded-[2px] bg-[#F5E2DE] px-3 py-2 font-mono text-xs text-accent">{error}</p>}

      <div className="space-y-1">
        <label htmlFor="title" className={formLabelClass}>
          Title
        </label>
        <input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} className={formInputClass} />
      </div>

      <div className="space-y-1">
        <label htmlFor="authors" className={formLabelClass}>
          Authors (comma-separated)
        </label>
        <input id="authors" value={authors} onChange={(e) => setAuthors(e.target.value)} className={formInputClass} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="publisher" className={formLabelClass}>
            Publisher
          </label>
          <input id="publisher" value={publisher} onChange={(e) => setPublisher(e.target.value)} className={formInputClass} />
        </div>
        <div className="space-y-1">
          <label htmlFor="pageCount" className={formLabelClass}>
            Pages
          </label>
          <input
            id="pageCount"
            type="number"
            min="1"
            value={pageCount}
            onChange={(e) => setPageCount(e.target.value)}
            className={formInputClass}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="bookCrossingId" className={formLabelClass}>
          BookCrossing ID
        </label>
        <input
          id="bookCrossingId"
          placeholder="e.g. 123-4567890"
          value={bookCrossingId}
          onChange={(e) => setBookCrossingId(e.target.value)}
          className={formInputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_120px]">
        <div className="space-y-1">
          <label htmlFor="coverUrl" className={formLabelClass}>
            Cover image URL
          </label>
          <input id="coverUrl" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} className={formInputClass} />
        </div>
        <div className="flex flex-col gap-2">
          <BookCover
            key={`${previewUrl}-${previewAttempt}`}
            src={previewUrl || null}
            alt="Cover preview"
            className="aspect-[2/3] w-[120px]"
          />
          <button
            type="button"
            onClick={refreshPreview}
            className="inline-flex items-center justify-center gap-1.5 rounded-[2px] border border-line-strong px-2 py-2 font-sans text-xs font-medium text-ink hover:bg-chip-hover"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[13px] w-[13px]">
              <path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v6h-6" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="description" className={formLabelClass}>
          Description
        </label>
        <textarea
          id="description"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${formInputClass} resize-y`}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-[2px] bg-accent px-[18px] py-[11px] font-sans text-sm font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        <Link
          href={`/${code}/copies/${copyId}`}
          className="inline-flex items-center rounded-[2px] border border-line-strong px-[18px] py-[11px] font-sans text-sm font-medium text-ink hover:bg-chip-hover"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
