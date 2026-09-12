"use client";

import { useEffect, useRef, useState } from "react";
import { BarcodeCameraScanner } from "@/components/barcode-camera-scanner";
import { BookCover } from "@/components/book-cover";
import { playErrorSound, playSuccessSound } from "@/lib/feedback-sound";

interface Shelf {
  id: string;
  name: string;
}

interface ScanResult {
  ok: boolean;
  message: string;
  title?: string;
  authors?: string[];
  coverUrl?: string | null;
}

export default function ScanStationPage() {
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [shelfId, setShelfId] = useState("");
  const [isbn, setIsbn] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/shelves")
      .then((res) => res.json())
      .then((data) => {
        setShelves(data.shelves ?? []);
        if (data.shelves?.length) setShelfId((current) => current || data.shelves[0].id);
      });
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  async function submitIsbn(rawIsbn: string) {
    if (!rawIsbn.trim() || busy) return;
    if (mode === "add" && !shelfId) {
      setResult({ ok: false, message: "Choose a shelf first." });
      playErrorSound();
      return;
    }

    setBusy(true);
    setResult(null);

    try {
      const res = await fetch(mode === "add" ? "/api/copies/scan-in" : "/api/copies/scan-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "add" ? { isbn: rawIsbn, shelfId } : { isbn: rawIsbn }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? "Something went wrong" });
        playErrorSound();
      } else if (mode === "add") {
        setResult({
          ok: true,
          message: data.lookupFailed
            ? "Added, but couldn't find book details — edit the title later."
            : "Added to your library.",
          title: data.copy.book.title,
          authors: data.copy.book.authors,
          coverUrl: data.copy.book.coverUrl,
        });
        playSuccessSound();
      } else {
        setResult({
          ok: true,
          message: data.copy.reservation
            ? `Removed — reservation for ${data.copy.reservation.reservedFor} marked fulfilled.`
            : "Removed from your library.",
          title: data.copy.book.title,
          authors: data.copy.book.authors,
          coverUrl: data.copy.book.coverUrl,
        });
        playSuccessSound();
      }
    } catch {
      setResult({ ok: false, message: "Network error — please try again." });
      playErrorSound();
    } finally {
      setBusy(false);
      setIsbn("");
      inputRef.current?.focus();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(["add", "remove"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setResult(null);
            }}
            className={`flex-1 rounded-lg px-4 py-2 font-medium ${
              mode === m
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "border border-gray-300 dark:border-gray-700"
            }`}
          >
            {m === "add" ? "Add a book" : "Remove a book"}
          </button>
        ))}
      </div>

      {mode === "add" && (
        <div className="space-y-1">
          <label htmlFor="shelf" className="text-sm font-medium">
            Shelf
          </label>
          <select
            id="shelf"
            value={shelfId}
            onChange={(e) => setShelfId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
          >
            {shelves.map((shelf) => (
              <option key={shelf.id} value={shelf.id}>
                {shelf.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitIsbn(isbn);
        }}
        className="flex gap-2"
      >
        <input
          ref={inputRef}
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          placeholder="Scan or type an ISBN"
          autoComplete="off"
          disabled={busy}
          className="flex-1 rounded-md border border-gray-300 px-3 py-3 text-lg dark:border-gray-700 dark:bg-gray-900"
        />
        <button
          type="button"
          onClick={() => setShowCamera(true)}
          className="rounded-md border border-gray-300 px-3 py-3 dark:border-gray-700"
          aria-label="Scan with camera"
        >
          📷
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-gray-900 px-4 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
        >
          Go
        </button>
      </form>

      {showCamera && (
        <BarcodeCameraScanner
          onDetected={(code) => {
            setShowCamera(false);
            setIsbn(code);
            submitIsbn(code);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {result && (
        <div
          className={`flex items-center gap-3 rounded-lg border p-4 ${
            result.ok
              ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950"
              : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
          }`}
        >
          {result.ok && result.coverUrl !== undefined && (
            <BookCover src={result.coverUrl} alt={result.title ?? ""} className="h-16 w-12 flex-shrink-0" />
          )}
          <div>
            {result.title && <p className="font-medium">{result.title}</p>}
            {result.authors && result.authors.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{result.authors.join(", ")}</p>
            )}
            <p className={`text-sm ${result.ok ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"}`}>
              {result.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
