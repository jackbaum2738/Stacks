"use client";

import { useEffect, useState } from "react";
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

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<BookResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data) => setBooks(data.books ?? []))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const trimmedQuery = query.trim();
  const visibleBooks = trimmedQuery ? books : [];

  function onQueryChange(value: string) {
    setQuery(value);
    setLoading(Boolean(value.trim()));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Search</h1>
      <input
        autoFocus
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search by title, author, or ISBN"
        className="w-full rounded-md border border-gray-300 px-3 py-3 text-lg dark:border-gray-700 dark:bg-gray-900"
      />

      {loading && <p className="text-sm text-gray-500">Searching…</p>}

      {!loading && trimmedQuery && visibleBooks.length === 0 && (
        <p className="text-sm text-gray-500">No books found.</p>
      )}

      <ul className="divide-y divide-gray-200 dark:divide-gray-800">
        {visibleBooks.map((book) =>
          book.copies.map((copy) => (
            <CopyRow key={copy.id} copy={{ ...copy, book }} />
          ))
        )}
      </ul>
    </div>
  );
}
