"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formLabelClass, formInputClass } from "@/lib/form-styles";

interface EditableBook {
  isbn13: string;
  title: string;
  authors: string[];
  publisher: string | null;
  pageCount: number | null;
  description: string | null;
  coverUrl: string | null;
}

export function EditBookForm({
  copyId,
  book,
  bookCrossingId: initialBookCrossingId,
}: {
  copyId: string;
  book: EditableBook;
  bookCrossingId: string | null;
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/copies/${copyId}/book`, {
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

    router.push(`/dashboard/copies/${copyId}`);
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

      <div className="space-y-1">
        <label htmlFor="coverUrl" className={formLabelClass}>
          Cover image URL
        </label>
        <input id="coverUrl" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} className={formInputClass} />
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
          href={`/dashboard/copies/${copyId}`}
          className="inline-flex items-center rounded-[2px] border border-line-strong px-[18px] py-[11px] font-sans text-sm font-medium text-ink hover:bg-chip-hover"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
