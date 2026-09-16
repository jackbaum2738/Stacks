"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCsv } from "@/lib/csv";

type TargetField =
  | "copyId"
  | "isbn"
  | "title"
  | "authors"
  | "publisher"
  | "shelf"
  | "status"
  | "reservedFor"
  | "contact"
  | "notes"
  | "bookCrossingId"
  | "ignore";

const TARGET_FIELDS: { key: TargetField; label: string; group: string | null }[] = [
  { key: "copyId", label: "Copy ID", group: "Match keys" },
  { key: "isbn", label: "ISBN", group: "Match keys" },
  { key: "title", label: "Title", group: "Book" },
  { key: "authors", label: "Authors", group: "Book" },
  { key: "publisher", label: "Publisher", group: "Book" },
  { key: "shelf", label: "Shelf", group: "Copy" },
  { key: "status", label: "Status (Available/Reserved/Removed)", group: "Copy" },
  { key: "reservedFor", label: "Reserved for", group: "Copy" },
  { key: "contact", label: "Reservation contact", group: "Copy" },
  { key: "notes", label: "Notes", group: "Copy" },
  { key: "bookCrossingId", label: "BookCrossing ID", group: "Copy" },
  { key: "ignore", label: "Ignore this column", group: null },
];

const SYNONYMS: Record<Exclude<TargetField, "ignore">, string[]> = {
  copyId: ["copyid", "copyrecordid", "internalid"],
  isbn: ["isbn", "isbn13", "isbn10", "ean"],
  title: ["title", "booktitle", "name"],
  authors: ["author", "authors", "authorname"],
  publisher: ["publisher", "imprint"],
  shelf: ["shelf", "shelfname", "location"],
  status: ["status", "copystatus", "state"],
  reservedFor: ["reservedfor", "reservedto", "reservee"],
  contact: ["contact", "contactemail", "email"],
  notes: ["notes", "note", "comment", "comments"],
  bookCrossingId: ["bcid", "bookcrossingid", "bookcrossing"],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function guessField(header: string): TargetField {
  const n = normalize(header);
  for (const key of Object.keys(SYNONYMS) as (keyof typeof SYNONYMS)[]) {
    if (SYNONYMS[key].includes(n)) return key;
  }
  return "ignore";
}

interface ParsedFile {
  fileName: string;
  headers: string[];
  rows: string[][];
  mapping: TargetField[];
}

interface Summary {
  newCount: number;
  updatedCount: number;
  skippedMissingIsbn: number;
  skippedInvalidIsbn: number;
}

type Stage = "idle" | "mapping" | "confirm" | "result";

function skippedTotal(s: Summary) {
  return s.skippedMissingIsbn + s.skippedInvalidIsbn;
}

function skipNoteText(s: Summary): string {
  const clauses: string[] = [];
  if (s.skippedMissingIsbn) clauses.push(`${s.skippedMissingIsbn} ${s.skippedMissingIsbn === 1 ? "row" : "rows"} skipped due to missing ISBN`);
  if (s.skippedInvalidIsbn) clauses.push(`${s.skippedInvalidIsbn} ${s.skippedInvalidIsbn === 1 ? "row" : "rows"} skipped due to invalid ISBN`);
  return clauses.join(", ") + ".";
}

function buildImportRows(parsed: ParsedFile): Record<string, string>[] {
  return parsed.rows.map((row) => {
    const obj: Record<string, string> = {};
    parsed.mapping.forEach((field, i) => {
      if (field === "ignore") return;
      const value = (row[i] ?? "").trim();
      if (value) obj[field] = value;
    });
    return obj;
  });
}

const btnPrimary =
  "rounded-[2px] bg-accent px-4 py-2 font-sans text-sm font-medium text-on-accent hover:brightness-95 disabled:opacity-50";
const btnGhost =
  "rounded-[2px] border border-line-strong px-4 py-2 font-sans text-sm font-medium text-ink hover:bg-chip-hover disabled:opacity-50";

export function BackupImportSection({
  lastBackup,
}: {
  lastBackup: { atLabel: string; byName: string } | null;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadConfirm, setDownloadConfirm] = useState(false);
  const [templateConfirm, setTemplateConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function triggerDownload(url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function handleBackupDownload() {
    triggerDownload("/api/library/export");
    setDownloadConfirm(true);
    setTimeout(() => setDownloadConfirm(false), 2600);
    setTimeout(() => router.refresh(), 800);
  }

  function handleTemplateDownload() {
    triggerDownload("/api/library/import-template");
    setTemplateConfirm(true);
    setTimeout(() => setTemplateConfirm(false), 2600);
  }

  function handleFile(file: File) {
    setDropError(null);
    if (!/\.csv$/i.test(file.name)) {
      setDropError(`“${file.name}” isn’t a CSV file — export your spreadsheet as .csv and try again.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const parsedCsv = parseCsv(String(reader.result));
      const headers = parsedCsv[0] ?? [];
      const rows = parsedCsv.slice(1);
      const used = new Set<TargetField>();
      const mapping = headers.map((h) => {
        const guess = guessField(h);
        if (guess !== "ignore") {
          if (used.has(guess)) return "ignore" as TargetField;
          used.add(guess);
        }
        return guess;
      });
      setParsed({ fileName: file.name, headers, rows, mapping });
      setStage("mapping");
    };
    reader.readAsText(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function setMappingAt(index: number, field: TargetField) {
    if (!parsed) return;
    const mapping = [...parsed.mapping];
    mapping[index] = field;
    setParsed({ ...parsed, mapping });
  }

  const isbnCount = parsed?.mapping.filter((m) => m === "isbn").length ?? 0;
  const usage = useMemo(() => {
    const map = new Map<TargetField, number[]>();
    parsed?.mapping.forEach((m, i) => {
      if (m === "ignore") return;
      map.set(m, [...(map.get(m) ?? []), i]);
    });
    return map;
  }, [parsed]);

  async function onContinueMapping() {
    if (!parsed || isbnCount !== 1) return;
    setBusy(true);
    setError(null);
    const rows = buildImportRows(parsed);
    const res = await fetch("/api/library/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows, dryRun: true }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Couldn't check this file — please try again.");
      return;
    }
    const data: Summary = await res.json();
    setSummary(data);
    setStage("confirm");
  }

  async function onConfirmImport() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    const rows = buildImportRows(parsed);
    const res = await fetch("/api/library/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Import failed — nothing was changed. Please try again.");
      return;
    }
    const data: Summary = await res.json();
    setSummary(data);
    setStage("result");
  }

  function reset() {
    setStage("idle");
    setParsed(null);
    setSummary(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  return (
    <>
      <div className="border border-line bg-surface">
        <div className="px-4 pt-3 font-sans text-[12.5px] font-semibold text-ink-soft">Backup</div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="font-sans text-sm text-ink-soft">
            {lastBackup ? (
              <>
                Last backup taken by <span className="text-ink">{lastBackup.byName}</span>
                <br />
                <span className="font-mono text-xs text-ink-faint">{lastBackup.atLabel}</span>
              </>
            ) : (
              "No backup taken yet"
            )}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleBackupDownload} className={btnPrimary}>
              Download CSV backup
            </button>
            {downloadConfirm && (
              <span className="font-sans text-sm font-semibold text-ok">&#10003; Downloaded</span>
            )}
          </div>
        </div>

        <div className="border-t border-line-inner px-4 pt-3 font-sans text-[12.5px] font-semibold text-ink-soft">
          Import
        </div>
        <div className="px-4 pb-4">
          <p className="mb-2 font-sans text-sm text-ink-soft">
            Import a CSV to add or update copies. Each row matches an existing copy by its Copy
            ID (from a Stacks export) &mdash; a row with no Copy ID, or one that doesn&rsquo;t
            match, is always added as a new copy. Anything already in your library that
            isn&rsquo;t in the file is left exactly as it is.
          </p>
          <p className="mb-3 font-sans text-xs text-ink-faint">
            <button type="button" onClick={handleTemplateDownload} className="font-semibold text-accent-2 underline underline-offset-2 hover:text-accent">
              Download import template
            </button>{" "}
            &mdash; a blank CSV with just the column headings, ready to fill in
            {templateConfirm && <span className="ml-2 font-semibold text-ok">&#10003; Downloaded</span>}
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center gap-2 border-[1.5px] border-dashed px-5 py-6 text-center ${
              dragOver ? "border-accent-2 bg-[color-mix(in_srgb,var(--accent-2)_8%,var(--bg))]" : "border-line-strong bg-bg"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-[28px] w-[28px] text-ink-faint">
              <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-sans text-sm font-medium text-ink">Drag &amp; drop a CSV here</span>
            <span className="font-mono text-xs text-ink-faint">.csv only</span>
            <button type="button" onClick={() => fileInputRef.current?.click()} className={`${btnGhost} mt-1`}>
              Choose file&hellip;
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {dropError && (
              <p className="mt-1 rounded-[2px] bg-[var(--pill-reserved-bg)] px-3 py-2 font-sans text-xs text-[var(--pill-reserved-fg)]">
                {dropError}
              </p>
            )}
          </div>
        </div>
      </div>

      {stage === "mapping" && parsed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,38,32,.45)] p-4">
          <div className="max-h-[calc(100vh-40px)] w-full max-w-[880px] overflow-y-auto rounded-[2px] border border-line-strong bg-surface p-[26px] shadow-[0_24px_44px_rgba(43,38,32,.3)]">
            <div className="mb-2 font-mono text-[11px] tracking-[.14em] text-accent-2 uppercase">Import &middot; step 1 of 2</div>
            <h2 className="mb-1 font-display text-2xl font-semibold text-ink">Match columns</h2>
            <p className="mb-5 font-sans text-sm text-ink-soft">
              We found {parsed.headers.length} columns in <span className="font-mono">{parsed.fileName}</span>. Pick
              which field each one maps to &mdash; we&rsquo;ve auto-matched what we recognized. Set a column to{" "}
              <em>Ignore</em> to leave it out.
            </p>

            <div className="overflow-x-auto border border-line">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr>
                    {parsed.headers.map((h, i) => {
                      const sel = parsed.mapping[i];
                      return (
                        <th key={i} className="min-w-[150px] border-r border-b border-line-inner bg-surface-raised p-2 text-left align-top last:border-r-0">
                          <div className="mb-1 font-mono text-[10px] tracking-[.06em] text-ink-faint uppercase">Column {i + 1}</div>
                          <div className="mb-2 font-sans text-[13px] font-semibold break-words text-ink">{h}</div>
                          <select
                            value={sel}
                            onChange={(e) => setMappingAt(i, e.target.value as TargetField)}
                            className={`w-full border px-1.5 py-1 font-sans text-xs ${
                              sel === "isbn" || sel === "copyId" ? "border-accent-2" : "border-line-strong"
                            } ${sel === "ignore" ? "text-ink-faint italic" : "text-ink"} bg-surface`}
                          >
                            {(() => {
                              const groups = new Map<string, typeof TARGET_FIELDS>();
                              TARGET_FIELDS.forEach((f) => {
                                const g = f.group ?? " ";
                                groups.set(g, [...(groups.get(g) ?? []), f]);
                              });
                              return [...groups.entries()].map(([g, fields]) => {
                                const options = fields.map((f) => {
                                  const takenElsewhere = f.key !== "ignore" && (usage.get(f.key) ?? []).some((idx) => idx !== i);
                                  return (
                                    <option key={f.key} value={f.key} disabled={takenElsewhere}>
                                      {f.label}
                                    </option>
                                  );
                                });
                                return g === " " ? options : <optgroup key={g} label={g}>{options}</optgroup>;
                              });
                            })()}
                          </select>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 3).map((row, ri) => (
                    <tr key={ri}>
                      {parsed.headers.map((_, i) => (
                        <td
                          key={i}
                          className={`max-w-[220px] overflow-hidden border-t border-r border-line-inner p-2 text-ellipsis whitespace-nowrap font-sans text-xs last:border-r-0 ${
                            parsed.mapping[i] === "ignore" ? "text-ink-faint opacity-60" : "text-ink-soft"
                          }`}
                          title={row[i] ?? ""}
                        >
                          {row[i] || <span className="font-mono text-ink-faint">&mdash;</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-sans text-xs text-ink-soft">
              <span>ISBN is required; Copy ID is optional but matches an exact existing copy</span>
              <span>Rows with no Copy ID match are always added as new copies</span>
              <span>Preview shows the first 3 rows of your file</span>
            </div>

            {isbnCount === 0 && (
              <p className="mt-3 rounded-[2px] bg-[var(--pill-reserved-bg)] px-3 py-2 font-sans text-sm text-[var(--pill-reserved-fg)]">
                Map one column to ISBN &mdash; it&rsquo;s how imported rows are matched to existing books.
              </p>
            )}
            {isbnCount > 1 && (
              <p className="mt-3 rounded-[2px] bg-[var(--pill-reserved-bg)] px-3 py-2 font-sans text-sm text-[var(--pill-reserved-fg)]">
                Only one column can map to ISBN.
              </p>
            )}
            {isbnCount === 1 && (
              <p className="mt-3 rounded-[2px] bg-[var(--pill-available-bg)] px-3 py-2 font-sans text-sm text-[var(--pill-available-fg)]">
                Looks good.
              </p>
            )}
            {error && <p className="mt-3 font-mono text-xs text-accent">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={reset} className={btnGhost}>
                Cancel
              </button>
              <button type="button" disabled={isbnCount !== 1 || busy} onClick={onContinueMapping} className={btnPrimary}>
                {busy ? "Checking…" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === "confirm" && summary && parsed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,38,32,.45)] p-4">
          <div className="w-full max-w-[480px] rounded-[2px] border border-line-strong bg-surface p-[26px] shadow-[0_24px_44px_rgba(43,38,32,.3)]">
            <div className="mb-2 font-mono text-[11px] tracking-[.14em] text-accent-2 uppercase">Import &middot; step 2 of 2</div>
            <h2 className="mb-1 font-display text-2xl font-semibold text-ink">Confirm import</h2>
            <p className="mb-5 font-sans text-sm text-ink-soft">
              <span className="font-mono">{parsed.fileName}</span> &mdash; rows are matched to your existing
              copies by Copy ID; anything without a match is added as a new copy.
            </p>

            <div className="mb-4 grid grid-cols-3 gap-2">
              <div className="paper-shadow-sm border border-line bg-surface-raised p-3 text-center">
                <div className="font-mono text-xl text-ok">{summary.newCount}</div>
                <div className="mt-0.5 font-sans text-[11px] text-ink-soft uppercase">New copies</div>
              </div>
              <div className="paper-shadow-sm border border-line bg-surface-raised p-3 text-center">
                <div className="font-mono text-xl text-accent-2">{summary.updatedCount}</div>
                <div className="mt-0.5 font-sans text-[11px] text-ink-soft uppercase">Matched &amp; updated</div>
              </div>
              <div className="paper-shadow-sm border border-line bg-surface-raised p-3 text-center">
                <div className="font-mono text-xl text-[var(--pill-reserved-fg)]">{skippedTotal(summary)}</div>
                <div className="mt-0.5 font-sans text-[11px] text-ink-soft uppercase">Skipped</div>
              </div>
            </div>

            {skippedTotal(summary) > 0 && (
              <p className="mb-3 rounded-[2px] bg-[var(--pill-reserved-bg)] px-3 py-2 font-sans text-sm text-[var(--pill-reserved-fg)]">
                {skipNoteText(summary)}
              </p>
            )}
            {error && <p className="mb-3 font-mono text-xs text-accent">{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setStage("mapping")} className={btnGhost}>
                Back
              </button>
              <button type="button" disabled={busy} onClick={onConfirmImport} className={btnPrimary}>
                {busy ? "Importing…" : "Import books"}
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === "result" && summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,38,32,.45)] p-4">
          <div className="w-full max-w-[480px] rounded-[2px] border border-line-strong bg-surface p-[26px] shadow-[0_24px_44px_rgba(43,38,32,.3)]">
            <div className="mb-3 flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[var(--pill-available-bg)] text-[var(--pill-available-fg)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[22px] w-[22px]">
                <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="mb-1 font-display text-2xl font-semibold text-ink">Import complete</h2>
            <p className="mb-3 font-sans text-sm text-ink-soft">
              <strong className="text-ink">{summary.newCount}</strong> new copies added,{" "}
              <strong className="text-ink">{summary.updatedCount}</strong> matched by Copy ID and updated,{" "}
              <strong className="text-ink">{skippedTotal(summary)}</strong> skipped. Everything else in your
              library was left untouched.
            </p>
            {skippedTotal(summary) > 0 && (
              <p className="mb-3 rounded-[2px] bg-[var(--pill-reserved-bg)] px-3 py-2 font-sans text-sm text-[var(--pill-reserved-fg)]">
                {skipNoteText(summary)}
              </p>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={reset} className={btnPrimary}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
