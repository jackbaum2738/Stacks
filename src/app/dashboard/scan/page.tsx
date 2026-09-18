"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BarcodeCameraScanner } from "@/components/barcode-camera-scanner";
import { BookCover } from "@/components/book-cover";
import { playErrorSound, playSuccessSound } from "@/lib/feedback-sound";
import { formLabelClass } from "@/lib/form-styles";
import { useLibraryRole } from "@/components/library-role-context";
import { ShelfCombobox, type ShelfSummary } from "@/components/shelf-combobox";

interface ScanResult {
  ok: boolean;
  message: string;
  title?: string;
  authors?: string[];
  coverUrl?: string | null;
  copyId?: string;
}

interface ScanOutChoice {
  id: string;
  shelfName: string | null;
  status: "AVAILABLE" | "RESERVED";
  addedAt: string;
  reservedForName: string | null;
}

interface ScanOutPicker {
  isbn: string;
  book: { title: string; authors: string[]; coverUrl: string | null };
  choices: ScanOutChoice[];
}

export default function ScanStationPage() {
  const { canEdit } = useLibraryRole();
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [shelves, setShelves] = useState<ShelfSummary[]>([]);
  const [selectedShelf, setSelectedShelf] = useState<ShelfSummary | null>(null);
  const [isbn, setIsbn] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [picker, setPicker] = useState<ScanOutPicker | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const shelfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/shelves")
      .then((res) => res.json())
      .then((data) => {
        setShelves(data.shelves ?? []);
        setSelectedShelf((current) => current ?? data.shelves?.[0] ?? null);
      });
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  function applyScanOutCopy(data: {
    copy: {
      id: string;
      book: { title: string; authors: string[]; coverUrl: string | null };
      shelf: { name: string } | null;
      reservation: { person: { name: string } | null } | null;
    };
  }) {
    const shelfName = data.copy.shelf?.name ?? "your library";
    setResult({
      ok: true,
      message: data.copy.reservation
        ? `Removed from ${shelfName} — reservation for ${data.copy.reservation.person?.name ?? "someone no longer in your directory"} marked fulfilled.`
        : `Removed from ${shelfName}.`,
      title: data.copy.book.title,
      authors: data.copy.book.authors,
      coverUrl: data.copy.book.coverUrl,
    });
    playSuccessSound();
  }

  async function submitIsbn(rawIsbn: string, shelfOverride?: ShelfSummary | null) {
    if (!rawIsbn.trim() || busy) return;
    const shelf = shelfOverride !== undefined ? shelfOverride : selectedShelf;
    if (mode === "add" && !shelf) {
      setResult({ ok: false, message: "Choose a shelf first." });
      playErrorSound();
      return;
    }

    setBusy(true);
    setResult(null);
    setPicker(null);

    try {
      const res = await fetch(mode === "add" ? "/api/copies/scan-in" : "/api/copies/scan-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "add" ? { isbn: rawIsbn, shelfId: shelf!.id } : { isbn: rawIsbn }),
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
      } else if (data.choices) {
        setPicker({ isbn: rawIsbn, book: data.book, choices: data.choices });
      } else {
        applyScanOutCopy(data);
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

  async function removeChosenCopy(copyId: string) {
    if (!picker || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/copies/scan-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isbn: picker.isbn, copyId }),
      });
      const data = await res.json();
      setPicker(null);

      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? "Something went wrong" });
        playErrorSound();
      } else {
        applyScanOutCopy(data);
      }
    } catch {
      setPicker(null);
      setResult({ ok: false, message: "Network error — please try again." });
      playErrorSound();
    } finally {
      setBusy(false);
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
              setPicker(null);
            }}
            className={`flex-1 px-4 py-2 font-sans font-medium ${
              mode === m ? "bg-ink text-surface" : "text-ink-muted hover:bg-chip-hover"
            }`}
          >
            {m === "add" ? "Add a book" : "Remove a book"}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitIsbn(isbn);
        }}
        className="space-y-4"
      >
        <div className="space-y-1">
          <label htmlFor="isbn" className={formLabelClass}>
            ISBN
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id="isbn"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (mode === "add") {
                  e.preventDefault();
                  shelfInputRef.current?.focus();
                }
              }}
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
          </div>
        </div>

        {mode === "add" ? (
          <div className="space-y-1">
            <label htmlFor="shelf" className={formLabelClass}>
              Shelf
            </label>
            <div className="flex items-start gap-2">
              <ShelfCombobox
                id="shelf"
                ref={shelfInputRef}
                shelves={shelves}
                selected={selectedShelf}
                onChange={setSelectedShelf}
                onEnterResolved={(shelf) => submitIsbn(isbn, shelf)}
              />
              <button
                type="submit"
                disabled={busy}
                className="flex-shrink-0 whitespace-nowrap rounded-[2px] bg-accent px-4 py-2.5 font-sans font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
              >
                Scan in
              </button>
            </div>
          </div>
        ) : (
          <button
            type="submit"
            disabled={busy}
            className="rounded-[2px] bg-accent px-4 py-3 font-sans font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
          >
            Scan out
          </button>
        )}
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

      {picker && (
        <div className="paper-shadow-sm rounded-[2px] border border-line-strong bg-surface p-4">
          <div className="flex gap-3 border-b border-line pb-3">
            <BookCover src={picker.book.coverUrl} alt={picker.book.title} className="h-14 w-10 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-display font-medium text-ink">{picker.book.title}</p>
              {picker.book.authors.length > 0 && (
                <p className="font-sans text-sm text-ink-soft">{picker.book.authors.join(", ")}</p>
              )}
              <p className="mt-1 font-sans text-sm text-ink-soft">
                {picker.choices.length} copies of this book are in your library. Pick the one you&apos;re holding.
              </p>
            </div>
          </div>

          <ul>
            {picker.choices.map((choice) => (
              <li key={choice.id} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-sm font-medium text-ink">
                    <span>{choice.shelfName ?? "No shelf"}</span>
                    <span
                      className={`rounded-[2px] px-1.5 py-0.5 font-mono text-[10.5px] font-medium ${
                        choice.status === "AVAILABLE"
                          ? "bg-pill-available-bg text-pill-available-fg"
                          : "bg-pill-reserved-bg text-pill-reserved-fg"
                      }`}
                    >
                      {choice.status === "AVAILABLE" ? "Available" : "Reserved"}
                    </span>
                  </div>
                  {choice.status === "RESERVED" ? (
                    <p className="mt-0.5 font-sans text-xs text-pill-reserved-fg">
                      Removing this releases the reservation for {choice.reservedForName ?? "someone no longer in your directory"}
                    </p>
                  ) : (
                    <p className="mt-0.5 font-sans text-xs text-ink-faint">
                      Added {new Date(choice.addedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeChosenCopy(choice.id)}
                  className={`flex-shrink-0 rounded-[2px] border px-3 py-1.5 font-sans text-sm font-medium hover:bg-chip-hover disabled:opacity-50 ${
                    choice.status === "RESERVED" ? "border-accent text-accent" : "border-line-strong text-ink"
                  }`}
                >
                  Remove this
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setPicker(null)}
            className="mt-1 w-full border-t border-line pt-3 text-center font-sans text-sm text-ink-soft underline decoration-line-strong underline-offset-2 hover:text-ink"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
