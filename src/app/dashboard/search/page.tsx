"use client";

import { useCallback, useEffect, useState } from "react";
import { CopyRow } from "@/components/copy-row";

interface BookResult {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  copies: {
    id: string;
    status: "AVAILABLE" | "RESERVED" | "REMOVED";
    shelf: { id: string; name: string } | null;
    reservation: { id: string; reservedFor: string; contact: string | null; note: string | null } | null;
  }[];
}

export default function LibraryBrowsePage() {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<BookResult[]>([]);
  const [loading, setLoading] = useState(true);

  const runSearch = useCallback((q: string) => {
    return fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((res) => res.json())
      .then((data) => setBooks(data.books ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => runSearch(query), 250);
    return () => clearTimeout(timeout);
  }, [query, runSearch]);

  function onQueryChange(value: string) {
    setQuery(value);
    setLoading(true);
  }

  const trimmedQuery = query.trim();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Library</h1>
      <input
        autoFocus
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search by title, author, or ISBN — or leave blank to browse everything"
        className="w-full rounded-md border border-gray-300 px-3 py-3 text-lg dark:border-gray-700 dark:bg-gray-900"
      />

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {!loading && books.length === 0 && (
        <p className="text-sm text-gray-500">
          {trimmedQuery ? "No books found." : "No books in your library yet."}
        </p>
      )}

      <ul className="divide-y divide-gray-200 dark:divide-gray-800">
        {books.map((book) =>
          book.copies.map((copy) => (
            <CopyRow key={copy.id} copy={{ ...copy, book }} onUpdated={() => runSearch(query)} />
          ))
        )}
      </ul>
    </div>
  );
}
