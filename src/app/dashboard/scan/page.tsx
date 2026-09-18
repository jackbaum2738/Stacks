"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BarcodeCameraScanner } from "@/components/barcode-camera-scanner";
import { BookCover } from "@/components/book-cover";
import { playErrorSound, playSuccessSound } from "@/lib/feedback-sound";
import { formLabelClass } from "@/lib/form-styles";
import { useLibraryRole } from "@/components/library-role-context";

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
  copyId?: string;
}

export default function ScanStationPage() {
  const { canEdit } = useLibraryRole();
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
          message: data.lookupFailed ? "Added, but couldn't find book details." : "Added to your library.",
          title: data.copy.book.title,
          authors: data.copy.book.authors,
          coverUrl: data.copy.book.coverUrl,
          copyId: data.copy.id,
        });
        playSuccessSound();
      } else {
        setResult({
          ok: true,
          message: data.copy.reservation
            ? `Removed — reservation for ${data.copy.reservation.person?.name ?? "someone no longer in your directory"} marked fulfilled.`
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

  if (!canEdit) {
    return (
      <div className="space-y-2">
        <h1 className="font-display text-[32px] font-semibold text-ink">Scan station</h1>
        <p className="font-sans text-sm text-ink-soft">
          View-only members can&apos;t scan books in or out.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex border border-line-strong">
        {(["add", "remove"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setResult(null);
            }}
            className={`flex-1 px-4 py-2 font-sans font-medium ${
              mode === m ? "bg-ink text-surface" : "text-ink-muted hover:bg-chip-hover"
            }`}
          >
            {m === "add" ? "Add a book" : "Remove a book"}
          </button>
        ))}
      </div>

      {mode === "add" && (
        <div className="space-y-1">
          <label htmlFor="shelf" className={formLabelClass}>
            Shelf
          </label>
          <select
            id="shelf"
            value={shelfId}
            onChange={(e) => setShelfId(e.target.value)}
            className="w-full border border-line-strong bg-surface px-3 py-2 font-sans text-ink"
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
          className="flex-1 border border-line-strong bg-surface px-3 py-3 font-mono text-lg text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-none"
        />
        <button
          type="button"
          onClick={() => setShowCamera(true)}
          className="inline-flex rounded-[2px] border border-line-strong px-3 py-3 hover:bg-chip-hover sm:hidden"
          aria-label="Scan with camera"
        >
          📷
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-[2px] bg-accent px-4 py-3 font-sans font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
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
          className={`flex items-center gap-3 rounded-[2px] border p-4 ${
            result.ok ? "border-line bg-pill-available-bg" : "border-line bg-[#F5E2DE]"
          }`}
        >
          {result.ok && result.coverUrl !== undefined && (
            <BookCover src={result.coverUrl} alt={result.title ?? ""} className="h-16 w-12 flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            {result.title && <p className="font-display font-medium text-ink">{result.title}</p>}
            {result.authors && result.authors.length > 0 && (
              <p className="font-sans text-sm text-ink-soft">{result.authors.join(", ")}</p>
            )}
            <p className={`font-sans text-sm ${result.ok ? "text-pill-available-fg" : "text-accent"}`}>
              {result.message}
            </p>
          </div>
          {result.copyId && (
            <Link
              href={`/dashboard/copies/${result.copyId}/edit`}
              className="flex-shrink-0 rounded-[2px] border border-line-strong bg-surface px-3 py-2 font-sans text-sm font-medium text-ink hover:bg-chip-hover"
            >
              Edit details
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
