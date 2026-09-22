"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCsv } from "@/lib/csv";
import { readZip } from "@/lib/backup-zip";
import { MarkLoader } from "@/components/mark-loader";

// Rows are sent to the import endpoints in small batches rather than all at once, each
// one committing fully before the next is sent -- see the routes' own doc comments for
// why (closing the tab mid-import only loses what hasn't been sent yet, nothing corrupts).
const IMPORT_BATCH_SIZE = 10;

type FileKind = "books" | "people";

const FIELD_DEFS: Record<FileKind, { key: string; label: string; group: string | null }[]> = {
  books: [
    { key: "copyId", label: "Copy ID", group: "Match keys" },
    { key: "isbn", label: "ISBN", group: "Match keys" },
    { key: "reservedForPersonId", label: "Reserved For — Person ID", group: "Match keys" },
    { key: "title", label: "Title", group: "Book" },
    { key: "authors", label: "Authors", group: "Book" },
    { key: "publisher", label: "Publisher", group: "Book" },
    { key: "shelf", label: "Shelf", group: "Copy" },
    { key: "status", label: "Status (Available/Reserved/Removed)", group: "Copy" },
    { key: "reservedFor", label: "Reserved for", group: "Copy" },
    { key: "notes", label: "Notes", group: "Copy" },
    { key: "bookCrossingId", label: "BookCrossing ID", group: "Copy" },
    { key: "ignore", label: "Ignore this column", group: null },
  ],
  people: [
    { key: "personId", label: "Person ID", group: "Match keys" },
    { key: "name", label: "Name", group: "Person" },
    { key: "email", label: "Email", group: "Person" },
    { key: "phone", label: "Phone", group: "Person" },
    { key: "location", label: "Location", group: "Person" },
    { key: "birthday", label: "Birthday", group: "Person" },
    { key: "ignore", label: "Ignore this column", group: null },
  ],
};

const SYNONYMS: Record<FileKind, Record<string, string[]>> = {
  books: {
    copyId: ["copyid", "copyrecordid", "internalid"],
    isbn: ["isbn", "isbn13", "isbn10", "ean"],
    reservedForPersonId: ["reservedforpersonid", "personid", "reserveeid"],
    title: ["title", "booktitle", "name"],
    authors: ["author", "authors", "authorname"],
    publisher: ["publisher", "imprint"],
    shelf: ["shelf", "shelfname", "location"],
    status: ["status", "copystatus", "state"],
    reservedFor: ["reservedfor", "reservedto", "reservee"],
    notes: ["notes", "note", "comment", "comments"],
    bookCrossingId: ["bcid", "bookcrossingid", "bookcrossing"],
  },
  people: {
    personId: ["personid", "personcode"],
    name: ["name", "personname", "fullname"],
    email: ["email", "emailaddress"],
    phone: ["phone", "phonenumber", "mobile", "mobilenumber"],
    location: ["location", "city", "address"],
    birthday: ["birthday", "dob", "dateofbirth"],
  },
};

// The one field each file kind must have exactly one column mapped to before continuing --
// ISBN is what a books row is matched/created around, Name is what a person row needs to
// exist at all (Person.name is required).
const KEY_FIELD: Record<FileKind, string> = { books: "isbn", people: "name" };
// Fields whose dropdown gets the "exact match key" highlight, same treatment as Copy ID
// always got -- these are the columns that can pin a row to one specific existing record.
const HIGHLIGHT_FIELDS: Record<FileKind, string[]> = {
  books: ["isbn", "copyId", "reservedForPersonId"],
  people: ["personId"],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function guessField(kind: FileKind, header: string): string {
  const n = normalize(header);
  const synonyms = SYNONYMS[kind];
  for (const key of Object.keys(synonyms)) {
    if (synonyms[key].includes(n)) return key;
  }
  return "ignore";
}

function initMapping(kind: FileKind, headers: string[]): string[] {
  const used = new Set<string>();
  return headers.map((h) => {
    const guess = guessField(kind, h);
    if (guess !== "ignore") {
      if (used.has(guess)) return "ignore";
      used.add(guess);
    }
    return guess;
  });
}

function detectFileKind(fileName: string, headers: string[]): FileKind {
  const lowerName = fileName.toLowerCase();
  if (lowerName.includes("people")) return "people";
  if (lowerName.includes("book")) return "books";
  const normalizedHeaders = headers.map(normalize);
  const looksLikeBooks = normalizedHeaders.some((h) => ["isbn", "isbn13", "isbn10", "copyid"].includes(h));
  if (looksLikeBooks) return "books";
  const looksLikePeople =
    normalizedHeaders.includes("personid") && normalizedHeaders.some((h) => h === "name" || h === "fullname");
  return looksLikePeople ? "people" : "books";
}

interface ParsedFile {
  kind: FileKind;
  fileName: string;
  headers: string[];
  rows: string[][];
  mapping: string[];
}

interface ParsedImport {
  books: ParsedFile | null;
  people: ParsedFile | null;
}

interface BooksSummary {
  newCount: number;
  updatedCount: number;
  skippedMissingIsbn: number;
  skippedInvalidIsbn: number;
  peopleNewCount: number;
  peopleMatchedCount: number;
}

interface PeopleSummary {
  newCount: number;
  updatedCount: number;
  skippedMissingName: number;
  emailConflicts: number;
}

interface ImportSummary {
  books: BooksSummary | null;
  people: PeopleSummary | null;
}

type BookRowOutcome = "new" | "updated" | "skippedMissingIsbn" | "skippedInvalidIsbn";
type PersonRowOutcome = "new" | "updated" | "skippedMissingName";

interface BookRowResult {
  label: string | null;
  outcome: BookRowOutcome;
  personOutcome: "matched" | "created" | "none" | null;
}

interface PersonRowResult {
  label: string | null;
  outcome: PersonRowOutcome;
}

interface QueuedRow {
  phase: FileKind;
  label: string | null;
  outcome: string;
  personOutcome?: "matched" | "created" | "none" | null;
}

interface LiveTallies {
  booksNew: number;
  booksUpdated: number;
  booksSkipped: number;
  peopleNew: number;
  peopleMatched: number;
  peopleSkipped: number;
}

const EMPTY_TALLIES: LiveTallies = {
  booksNew: 0,
  booksUpdated: 0,
  booksSkipped: 0,
  peopleNew: 0,
  peopleMatched: 0,
  peopleSkipped: 0,
};

type Stage = "idle" | "mapping" | "confirm" | "result";

function skippedBooksTotal(s: BooksSummary) {
  return s.skippedMissingIsbn + s.skippedInvalidIsbn;
}

function booksSkipNoteText(s: BooksSummary): string {
  const clauses: string[] = [];
  if (s.skippedMissingIsbn) clauses.push(`${s.skippedMissingIsbn} ${s.skippedMissingIsbn === 1 ? "row" : "rows"} skipped due to missing ISBN`);
  if (s.skippedInvalidIsbn) clauses.push(`${s.skippedInvalidIsbn} ${s.skippedInvalidIsbn === 1 ? "row" : "rows"} skipped due to invalid ISBN`);
  return clauses.join(", ") + ".";
}

function peopleSkipNoteText(s: PeopleSummary): string {
  const clauses: string[] = [];
  if (s.skippedMissingName) clauses.push(`${s.skippedMissingName} ${s.skippedMissingName === 1 ? "row" : "rows"} skipped due to a missing name`);
  if (s.emailConflicts) {
    clauses.push(
      `${s.emailConflicts} ${s.emailConflicts === 1 ? "row" : "rows"} had an email already used by another person (kept their existing email)`
    );
  }
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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Mapping steps in the order they're shown -- books before people when both are present,
// matching the mockup; the actual import order (below) runs people first instead, since
// books rows can then match a person's exact Person ID as soon as it exists.
function mappingSteps(parsed: ParsedImport): FileKind[] {
  const steps: FileKind[] = [];
  if (parsed.books) steps.push("books");
  if (parsed.people) steps.push("people");
  return steps;
}

const btnPrimary =
  "rounded-[2px] bg-accent px-4 py-2 font-sans text-sm font-medium text-on-accent hover:brightness-95 disabled:opacity-50";
const btnGhost =
  "rounded-[2px] border border-line-strong px-4 py-2 font-sans text-sm font-medium text-ink hover:bg-chip-hover disabled:opacity-50";

export function BackupImportSection({
  lastBackup: initialLastBackup,
  canImport,
  canExport,
}: {
  lastBackup: { atLabel: string; byName: string } | null;
  canImport: boolean;
  canExport: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"backup" | "import">("backup");
  const [stage, setStage] = useState<Stage>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [mapStep, setMapStep] = useState<FileKind>("books");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState(initialLastBackup);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadConfirm, setDownloadConfirm] = useState(false);
  const [templateConfirm, setTemplateConfirm] = useState(false);
  const [booksExportBusy, setBooksExportBusy] = useState(false);
  const [booksExportConfirm, setBooksExportConfirm] = useState(false);
  const [peopleExportBusy, setPeopleExportBusy] = useState(false);
  const [peopleExportConfirm, setPeopleExportConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live import progress. Rows are revealed one at a time from a queue fed by whichever
  // batch just landed, at a pace that adapts to the real observed speed of each batch --
  // that's what keeps this feeling continuous even though the data actually arrives in
  // chunks. See onConfirmImport/startReveal below.
  const [progressDone, setProgressDone] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [liveTallies, setLiveTallies] = useState<LiveTallies>(EMPTY_TALLIES);
  const [tickerLabel, setTickerLabel] = useState<string | null>(null);
  const [tickerPhase, setTickerPhase] = useState<FileKind | null>(null);
  const revealQueueRef = useRef<QueuedRow[]>([]);
  const revealMsPerRowRef = useRef(300);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  // Whether this run also has its own people.csv -- read inside the reveal loop's closure,
  // so a books row's implied person (see the import route's personOutcome) is only folded
  // into the People tallies when there's no dedicated people.csv already covering that.
  const hasPeopleFileRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  function revealOneRow() {
    const next = revealQueueRef.current.shift();
    if (!next) return; // nothing new yet -- hold position rather than guess
    setProgressDone((n) => n + 1);
    setTickerLabel(next.label);
    setTickerPhase(next.phase);
    setLiveTallies((t) => {
      const nt = { ...t };
      if (next.phase === "books") {
        if (next.outcome === "new") nt.booksNew++;
        else if (next.outcome === "updated") nt.booksUpdated++;
        else nt.booksSkipped++;
        if (!hasPeopleFileRef.current && next.personOutcome) {
          if (next.personOutcome === "created") nt.peopleNew++;
          else if (next.personOutcome === "matched") nt.peopleMatched++;
        }
      } else {
        if (next.outcome === "new") nt.peopleNew++;
        else if (next.outcome === "updated") nt.peopleMatched++;
        else nt.peopleSkipped++;
      }
      return nt;
    });
  }

  function startReveal() {
    stopReveal();
    const loop = () => {
      if (!cancelledRef.current) revealOneRow();
      revealTimerRef.current = setTimeout(loop, revealMsPerRowRef.current);
    };
    revealTimerRef.current = setTimeout(loop, revealMsPerRowRef.current);
  }

  function stopReveal() {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }

  function waitForQueueDrain(cb: () => void) {
    const check = () => {
      if (cancelledRef.current) return;
      if (revealQueueRef.current.length === 0) cb();
      else setTimeout(check, 50);
    };
    check();
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function filenameFromDisposition(disposition: string | null, fallback: string) {
    const match = disposition?.match(/filename="([^"]+)"/);
    return match?.[1] ?? fallback;
  }

  async function handleBackupDownload() {
    setDownloadBusy(true);
    const res = await fetch("/api/library/export");
    setDownloadBusy(false);
    if (!res.ok) {
      setError("Couldn't create a backup — please try again.");
      return;
    }
    const blob = await res.blob();
    downloadBlob(blob, filenameFromDisposition(res.headers.get("Content-Disposition"), "library-backup.zip"));

    // The export just updated Library.lastBackupAt/lastBackupByUserId server-side (it's
    // already awaited by the time this response arrived), so this reflects it immediately
    // rather than waiting on a timed router.refresh() to maybe have landed by then.
    const takenAt = res.headers.get("X-Backup-Taken-At");
    const byName = res.headers.get("X-Backup-Taken-By");
    if (takenAt && byName) {
      setLastBackup({
        atLabel: new Date(takenAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
        byName,
      });
    }
    setDownloadConfirm(true);
    setTimeout(() => setDownloadConfirm(false), 2600);
    router.refresh();
  }

  async function handleSingleFileExport(
    kind: "books" | "people",
    setBusy2: (v: boolean) => void,
    setConfirm: (v: boolean) => void,
    fallbackName: string
  ) {
    setBusy2(true);
    const res = await fetch(`/api/library/export/${kind}`);
    setBusy2(false);
    if (!res.ok) {
      setError(`Couldn't export ${kind === "books" ? "the library" : "people"} — please try again.`);
      return;
    }
    const blob = await res.blob();
    downloadBlob(blob, filenameFromDisposition(res.headers.get("Content-Disposition"), fallbackName));
    setConfirm(true);
    setTimeout(() => setConfirm(false), 2600);
  }

  async function handleTemplateDownload() {
    const res = await fetch("/api/library/import-template");
    if (!res.ok) {
      setError("Couldn't create the template — please try again.");
      return;
    }
    const blob = await res.blob();
    downloadBlob(blob, filenameFromDisposition(res.headers.get("Content-Disposition"), "stacks-import-template.zip"));
    setTemplateConfirm(true);
    setTimeout(() => setTemplateConfirm(false), 2600);
  }

  function buildParsedFile(kind: FileKind, fileName: string, headers: string[], rows: string[][]): ParsedFile {
    return { kind, fileName, headers, rows, mapping: initMapping(kind, headers) };
  }

  async function handleFile(file: File) {
    setDropError(null);
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith(".zip")) {
      let entries: Record<string, string>;
      try {
        entries = await readZip(await file.arrayBuffer());
      } catch {
        setDropError(`Couldn't read “${file.name}” — is it a valid zip file?`);
        return;
      }
      const booksEntry = Object.keys(entries).find((n) => /(^|\/)books\.csv$/i.test(n));
      const peopleEntry = Object.keys(entries).find((n) => /(^|\/)people\.csv$/i.test(n));
      if (!booksEntry && !peopleEntry) {
        setDropError(`“${file.name}” doesn't contain a books.csv or people.csv file.`);
        return;
      }
      const books = booksEntry ? parseCsv(entries[booksEntry]) : null;
      const people = peopleEntry ? parseCsv(entries[peopleEntry]) : null;
      const next: ParsedImport = {
        books: books ? buildParsedFile("books", "books.csv", books[0] ?? [], books.slice(1)) : null,
        people: people ? buildParsedFile("people", "people.csv", people[0] ?? [], people.slice(1)) : null,
      };
      setParsed(next);
      setMapStep(mappingSteps(next)[0]);
      setStage("mapping");
      return;
    }

    if (!lowerName.endsWith(".csv")) {
      setDropError(`“${file.name}” isn't a CSV or ZIP file — export your spreadsheet as .csv, or upload a Stacks backup .zip.`);
      return;
    }

    const text = await file.text();
    const parsedCsv = parseCsv(text);
    const headers = parsedCsv[0] ?? [];
    const rows = parsedCsv.slice(1);
    const kind = detectFileKind(file.name, headers);
    const parsedFile = buildParsedFile(kind, file.name, headers, rows);
    const next: ParsedImport = kind === "books" ? { books: parsedFile, people: null } : { books: null, people: parsedFile };
    setParsed(next);
    setMapStep(kind);
    setStage("mapping");
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function setMappingAt(kind: FileKind, index: number, field: string) {
    if (!parsed) return;
    const target = parsed[kind];
    if (!target) return;
    const mapping = [...target.mapping];
    mapping[index] = field;
    setParsed({ ...parsed, [kind]: { ...target, mapping } });
  }

  const currentFile = parsed?.[mapStep] ?? null;
  const keyFieldCount = currentFile?.mapping.filter((m) => m === KEY_FIELD[mapStep]).length ?? 0;
  const usage = useMemo(() => {
    const map = new Map<string, number[]>();
    currentFile?.mapping.forEach((m, i) => {
      if (m === "ignore") return;
      map.set(m, [...(map.get(m) ?? []), i]);
    });
    return map;
  }, [currentFile]);

  async function runDryRun() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      let books: BooksSummary | null = null;
      let people: PeopleSummary | null = null;

      if (parsed.books) {
        const res = await fetch("/api/library/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: buildImportRows(parsed.books), dryRun: true }),
        });
        if (!res.ok) throw new Error("books dry run failed");
        books = await res.json();
      }
      if (parsed.people) {
        const res = await fetch("/api/library/import-people", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: buildImportRows(parsed.people), dryRun: true }),
        });
        if (!res.ok) throw new Error("people dry run failed");
        people = await res.json();
      }

      setSummary({ books, people });
      setStage("confirm");
    } catch {
      setError("Couldn't check this file — please try again.");
    } finally {
      setBusy(false);
    }
  }

  function onContinueMapping() {
    if (!parsed || keyFieldCount !== 1) return;
    const steps = mappingSteps(parsed);
    const idx = steps.indexOf(mapStep);
    if (idx < steps.length - 1) {
      setMapStep(steps[idx + 1]);
    } else {
      runDryRun();
    }
  }

  function onBackMapping() {
    if (!parsed) return;
    const steps = mappingSteps(parsed);
    const idx = steps.indexOf(mapStep);
    if (idx > 0) setMapStep(steps[idx - 1]);
    else reset();
  }

  function onBackFromConfirm() {
    if (!parsed) return;
    const steps = mappingSteps(parsed);
    setMapStep(steps[steps.length - 1]);
    setStage("mapping");
  }

  async function onConfirmImport() {
    if (!parsed) return;
    setError(null);
    setBusy(true);
    setProgressDone(0);
    setTickerLabel(null);
    setTickerPhase(null);
    setLiveTallies(EMPTY_TALLIES);
    revealQueueRef.current = [];
    revealMsPerRowRef.current = 300;
    cancelledRef.current = false;

    const hasBooksFile = Boolean(parsed.books);
    const hasPeopleFile = Boolean(parsed.people);
    hasPeopleFileRef.current = hasPeopleFile;

    const peopleRows = parsed.people ? buildImportRows(parsed.people) : [];
    const booksRows = parsed.books ? buildImportRows(parsed.books) : [];
    const totalRows = peopleRows.length + booksRows.length;
    setProgressTotal(totalRows);
    startReveal();

    const peopleAcc: PeopleSummary = { newCount: 0, updatedCount: 0, skippedMissingName: 0, emailConflicts: 0 };
    const booksAcc: BooksSummary = {
      newCount: 0,
      updatedCount: 0,
      skippedMissingIsbn: 0,
      skippedInvalidIsbn: 0,
      peopleNewCount: 0,
      peopleMatchedCount: 0,
    };
    let processed = 0;

    function stopWithPartialFailure() {
      stopReveal();
      cancelledRef.current = true;
      setSummary({ books: hasBooksFile ? booksAcc : null, people: hasPeopleFile ? peopleAcc : null });
      setError(
        `Import stopped after ${processed} of ${totalRows} rows — what was already imported is saved. Re-run this file to pick up the rest.`
      );
      setBusy(false);
    }

    // People import first, then books -- a books row carrying a Person ID from the same
    // backup can then match it exactly rather than falling back to a name-based guess.
    if (parsed.people) {
      for (const batch of chunk(peopleRows, IMPORT_BATCH_SIZE)) {
        const startedAt = performance.now();
        let res: Response;
        try {
          res = await fetch("/api/library/import-people", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: batch }),
          });
        } catch {
          stopWithPartialFailure();
          return;
        }
        if (!res.ok) {
          stopWithPartialFailure();
          return;
        }
        const data: PeopleSummary & { rowResults: PersonRowResult[] } = await res.json();
        peopleAcc.newCount += data.newCount;
        peopleAcc.updatedCount += data.updatedCount;
        peopleAcc.skippedMissingName += data.skippedMissingName;
        peopleAcc.emailConflicts += data.emailConflicts;
        processed += batch.length;

        const observedMsPerRow = (performance.now() - startedAt) / batch.length;
        revealMsPerRowRef.current = Math.min(900, Math.max(40, observedMsPerRow * 0.85));
        revealQueueRef.current.push(...data.rowResults.map((r) => ({ phase: "people" as const, label: r.label, outcome: r.outcome })));
      }
    }

    if (parsed.books) {
      for (const batch of chunk(booksRows, IMPORT_BATCH_SIZE)) {
        const startedAt = performance.now();
        let res: Response;
        try {
          res = await fetch("/api/library/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: batch }),
          });
        } catch {
          stopWithPartialFailure();
          return;
        }
        if (!res.ok) {
          stopWithPartialFailure();
          return;
        }
        const data: BooksSummary & { rowResults: BookRowResult[] } = await res.json();
        booksAcc.newCount += data.newCount;
        booksAcc.updatedCount += data.updatedCount;
        booksAcc.skippedMissingIsbn += data.skippedMissingIsbn;
        booksAcc.skippedInvalidIsbn += data.skippedInvalidIsbn;
        booksAcc.peopleNewCount += data.peopleNewCount;
        booksAcc.peopleMatchedCount += data.peopleMatchedCount;
        processed += batch.length;

        const observedMsPerRow = (performance.now() - startedAt) / batch.length;
        revealMsPerRowRef.current = Math.min(900, Math.max(40, observedMsPerRow * 0.85));
        revealQueueRef.current.push(
          ...data.rowResults.map((r) => ({ phase: "books" as const, label: r.label, outcome: r.outcome, personOutcome: r.personOutcome }))
        );
      }
    }

    waitForQueueDrain(() => {
      stopReveal();
      setSummary({ books: hasBooksFile ? booksAcc : null, people: hasPeopleFile ? peopleAcc : null });
      setBusy(false);
      setStage("result");
    });
  }

  function reset() {
    cancelledRef.current = true;
    stopReveal();
    setStage("idle");
    setParsed(null);
    setMapStep("books");
    setSummary(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  const mapSteps = parsed ? mappingSteps(parsed) : [];
  const mapStepNumber = mapSteps.indexOf(mapStep) + 1;
  const mapStepTotal = mapSteps.length + 1;
  const hasPeopleFile = Boolean(parsed?.people);
  const hasBooksFile = Boolean(parsed?.books);
  const bothPhases = hasPeopleFile && hasBooksFile;

  const peopleNewDisplay = summary ? (hasPeopleFile ? summary.people!.newCount : (summary.books?.peopleNewCount ?? 0)) : 0;
  const peopleMatchedDisplay = summary
    ? hasPeopleFile
      ? summary.people!.updatedCount
      : (summary.books?.peopleMatchedCount ?? 0)
    : 0;
  const peopleCaption = !hasPeopleFile
    ? `Created automatically from “Reserved for” — there's no people.csv to match against, so a new person is made whenever a name (with no Person ID) doesn't already exist.`
    : hasBooksFile
      ? null // zip: self-evident, no caption needed
      : `Matched by Person ID only, same rule as Copy ID — a row with no ID, or one that doesn't match, always creates a new person rather than guessing by name or email.`;

  const showTabs = canImport && canExport;
  const effectiveTab: "backup" | "import" = showTabs ? activeTab : canExport ? "backup" : "import";

  return (
    <>
      <div>
        {showTabs && (
          <div className="-mb-px flex gap-0.5" role="tablist">
            <button
              type="button"
              role="tab"
              onClick={() => setActiveTab("backup")}
              aria-selected={effectiveTab === "backup"}
              className={`border border-b-0 px-4 py-2.5 font-mono text-[11.5px] font-semibold tracking-[.06em] uppercase ${
                effectiveTab === "backup"
                  ? "border-line-strong bg-surface text-ink"
                  : "border-line bg-bg text-ink-soft hover:text-ink"
              }`}
            >
              Backup
            </button>
            <button
              type="button"
              role="tab"
              onClick={() => setActiveTab("import")}
              aria-selected={effectiveTab === "import"}
              className={`border border-b-0 px-4 py-2.5 font-mono text-[11.5px] font-semibold tracking-[.06em] uppercase ${
                effectiveTab === "import"
                  ? "border-line-strong bg-surface text-ink"
                  : "border-line bg-bg text-ink-soft hover:text-ink"
              }`}
            >
              Import
            </button>
          </div>
        )}

        <div className="border border-line bg-surface">
          {effectiveTab === "backup" && canExport && (
            <div className="p-4">
              <p className="mb-3 font-sans text-[12.5px] font-semibold text-ink-soft">Choose what to export</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-2 border border-line bg-surface-raised p-3.5">
                  <p className="font-display text-base font-semibold text-ink">Full backup</p>
                  <p className="flex-1 font-sans text-[12.5px] text-ink-soft">Everything — books and people — in one zip.</p>
                  <p className="font-sans text-xs text-ink-soft">
                    {lastBackup ? (
                      <>
                        Last taken by <span className="text-ink">{lastBackup.byName}</span>
                        <br />
                        <span className="font-mono text-[11px] text-ink-faint">{lastBackup.atLabel}</span>
                      </>
                    ) : (
                      "Never taken"
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={handleBackupDownload} disabled={downloadBusy} className={btnPrimary}>
                      {downloadBusy ? "Preparing…" : "Download"}
                    </button>
                    {downloadConfirm && <span className="font-sans text-xs font-semibold text-ok">&#10003; Downloaded</span>}
                  </div>
                </div>

                <div className="flex flex-col gap-2 border border-line bg-surface-raised p-3.5">
                  <p className="font-display text-base font-semibold text-ink">Library only</p>
                  <p className="flex-1 font-sans text-[12.5px] text-ink-soft">
                    Just the catalog — every copy, its shelf, status, and who it&rsquo;s reserved for.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSingleFileExport("books", setBooksExportBusy, setBooksExportConfirm, "library.csv")}
                      disabled={booksExportBusy}
                      className={btnGhost}
                    >
                      {booksExportBusy ? "Preparing…" : "Download"}
                    </button>
                    {booksExportConfirm && <span className="font-sans text-xs font-semibold text-ok">&#10003; Downloaded</span>}
                  </div>
                </div>

                <div className="flex flex-col gap-2 border border-line bg-surface-raised p-3.5">
                  <p className="font-display text-base font-semibold text-ink">People only</p>
                  <p className="flex-1 font-sans text-[12.5px] text-ink-soft">
                    The full People directory, independent of who currently has a book reserved.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSingleFileExport("people", setPeopleExportBusy, setPeopleExportConfirm, "people.csv")}
                      disabled={peopleExportBusy}
                      className={btnGhost}
                    >
                      {peopleExportBusy ? "Preparing…" : "Download"}
                    </button>
                    {peopleExportConfirm && <span className="font-sans text-xs font-semibold text-ok">&#10003; Downloaded</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {effectiveTab === "import" && canImport && (
            <div className="p-4">
              <p className="mb-2 font-sans text-sm text-ink-soft">
                Import a Stacks backup .zip, or a books.csv/people.csv on its own. Rows match an existing copy by
                Copy ID and an existing person by Person ID &mdash; anything with no match, or one that
                doesn&rsquo;t match, is always added as new. A zip with both files imports people first, so a book
                row can match its reservee&rsquo;s exact Person ID.
              </p>
              <p className="mb-3 font-sans text-xs text-ink-faint">
                <button type="button" onClick={handleTemplateDownload} className="font-semibold text-accent-2 underline underline-offset-2 hover:text-accent">
                  Download import template
                </button>{" "}
                &mdash; a zip of two blank CSVs with just the column headings, ready to fill in
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
                <span className="font-sans text-sm font-medium text-ink">Drag &amp; drop a CSV or ZIP here</span>
                <span className="font-mono text-xs text-ink-faint">.csv or .zip</span>
                <button type="button" onClick={() => fileInputRef.current?.click()} className={`${btnGhost} mt-1`}>
                  Choose file&hellip;
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.zip,text/csv,application/zip"
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
          )}
        </div>
      </div>

      {stage === "mapping" && parsed && currentFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,38,32,.45)] p-4">
          <div className="max-h-[calc(100vh-40px)] w-full max-w-[880px] overflow-y-auto rounded-[2px] border border-line-strong bg-surface p-[26px] shadow-[0_24px_44px_rgba(43,38,32,.3)]">
            <div className="mb-2 font-mono text-[11px] tracking-[.14em] text-accent-2 uppercase">
              Import &middot; step {mapStepNumber} of {mapStepTotal}
            </div>
            <h2 className="mb-1 font-display text-2xl font-semibold text-ink">
              Match columns &mdash; {mapStep === "books" ? "Books" : "People"}
            </h2>
            <p className="mb-5 font-sans text-sm text-ink-soft">
              {mapSteps.length > 1 && <>Your file has both books and people &mdash; mapping one at a time. </>}
              We found {currentFile.headers.length} columns in <span className="font-mono">{currentFile.fileName}</span>. Pick
              which field each one maps to &mdash; we&rsquo;ve auto-matched what we recognized. Set a column to{" "}
              <em>Ignore</em> to leave it out.
            </p>

            <div className="overflow-x-auto border border-line">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr>
                    {currentFile.headers.map((h, i) => {
                      const sel = currentFile.mapping[i];
                      return (
                        <th key={i} className="min-w-[150px] border-r border-b border-line-inner bg-surface-raised p-2 text-left align-top last:border-r-0">
                          <div className="mb-1 font-mono text-[10px] tracking-[.06em] text-ink-faint uppercase">Column {i + 1}</div>
                          <div className="mb-2 font-sans text-[13px] font-semibold break-words text-ink">{h}</div>
                          <select
                            value={sel}
                            onChange={(e) => setMappingAt(mapStep, i, e.target.value)}
                            className={`w-full border px-1.5 py-1 font-sans text-xs ${
                              HIGHLIGHT_FIELDS[mapStep].includes(sel) ? "border-accent-2" : "border-line-strong"
                            } ${sel === "ignore" ? "text-ink-faint italic" : "text-ink"} bg-surface`}
                          >
                            {(() => {
                              const groups = new Map<string, typeof FIELD_DEFS.books>();
                              FIELD_DEFS[mapStep].forEach((f) => {
                                const g = f.group ?? " ";
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
                                return g === " " ? options : <optgroup key={g} label={g}>{options}</optgroup>;
                              });
                            })()}
                          </select>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {currentFile.rows.slice(0, 3).map((row, ri) => (
                    <tr key={ri}>
                      {currentFile.headers.map((_, i) => (
                        <td
                          key={i}
                          className={`max-w-[220px] overflow-hidden border-t border-r border-line-inner p-2 text-ellipsis whitespace-nowrap font-sans text-xs last:border-r-0 ${
                            currentFile.mapping[i] === "ignore" ? "text-ink-faint opacity-60" : "text-ink-soft"
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
              {mapStep === "books" ? (
                <>
                  <span>ISBN is required; Copy ID and Reserved For Person ID are optional exact-match keys</span>
                  <span>Rows with no match are always added as new</span>
                </>
              ) : (
                <>
                  <span>Name is required; Person ID is an optional exact-match key</span>
                  <span>Rows with no Person ID match are always added as a new person</span>
                </>
              )}
              <span>Preview shows the first 3 rows of your file</span>
            </div>

            {keyFieldCount === 0 && (
              <p className="mt-3 rounded-[2px] bg-[var(--pill-reserved-bg)] px-3 py-2 font-sans text-sm text-[var(--pill-reserved-fg)]">
                Map one column to {mapStep === "books" ? "ISBN" : "Name"} &mdash; it&rsquo;s how imported rows are
                matched{mapStep === "books" ? " to existing books" : ""}.
              </p>
            )}
            {keyFieldCount > 1 && (
              <p className="mt-3 rounded-[2px] bg-[var(--pill-reserved-bg)] px-3 py-2 font-sans text-sm text-[var(--pill-reserved-fg)]">
                Only one column can map to {mapStep === "books" ? "ISBN" : "Name"}.
              </p>
            )}
            {keyFieldCount === 1 && (
              <p className="mt-3 rounded-[2px] bg-[var(--pill-available-bg)] px-3 py-2 font-sans text-sm text-[var(--pill-available-fg)]">
                Looks good.
              </p>
            )}
            {error && <p className="mt-3 font-mono text-xs text-accent">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onBackMapping} className={btnGhost}>
                {mapSteps.indexOf(mapStep) > 0 ? "Back" : "Cancel"}
              </button>
              <button type="button" disabled={keyFieldCount !== 1 || busy} onClick={onContinueMapping} className={btnPrimary}>
                {busy ? "Checking…" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === "confirm" && summary && parsed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,38,32,.45)] p-4">
          <div className="w-full max-w-[480px] rounded-[2px] border border-line-strong bg-surface p-[26px] shadow-[0_24px_44px_rgba(43,38,32,.3)]">
            <div className="mb-2 font-mono text-[11px] tracking-[.14em] text-accent-2 uppercase">
              Import &middot; step {mapStepTotal} of {mapStepTotal}
            </div>

            {busy ? (
              <>
                <h2 className="mb-5 font-display text-2xl font-semibold text-ink">Importing&hellip;</h2>
                <div className="flex flex-col items-center gap-3 pt-2 pb-5">
                  <MarkLoader />
                </div>

                {bothPhases && (
                  <div className="mb-2 text-center font-mono text-[10px] tracking-[.06em] text-accent-2 uppercase">
                    {tickerPhase === "books" ? "Phase 2 of 2 — Books" : "Phase 1 of 2 — People"}
                  </div>
                )}

                <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-line-inner">
                  <div
                    className="h-full rounded-full bg-accent-2 transition-[width] duration-200 ease-linear"
                    style={{ width: `${progressTotal ? Math.round((progressDone / progressTotal) * 100) : 0}%` }}
                  />
                </div>
                <div className="mb-4 flex items-center justify-between font-sans text-sm text-ink">
                  <span>
                    Row <strong className="tabular-nums">{progressDone}</strong> of{" "}
                    <strong className="tabular-nums">{progressTotal}</strong>
                  </span>
                  <span className="font-mono text-xs tabular-nums text-ink-faint">
                    &middot; {progressTotal ? Math.round((progressDone / progressTotal) * 100) : 0}%
                  </span>
                </div>

                <p className="mb-4 truncate font-mono text-xs text-ink-soft">
                  <span className="mr-1.5 text-[10px] tracking-[.04em] text-ink-faint uppercase">
                    {tickerPhase === "books" ? "Book" : tickerPhase === "people" ? "Person" : "Importing"}
                  </span>{" "}
                  {tickerLabel ?? "—"}
                </p>

                {hasBooksFile && (
                  <>
                    <div className="mb-1 font-mono text-[9.5px] tracking-[.07em] text-ink-soft uppercase">Books</div>
                    <div className="mb-3 grid grid-cols-3 gap-2">
                      <div className="paper-shadow-sm border border-line bg-surface-raised p-2.5 text-center">
                        <div className="font-mono text-lg tabular-nums text-ok">{liveTallies.booksNew}</div>
                        <div className="mt-0.5 font-sans text-[10px] text-ink-soft uppercase">New</div>
                      </div>
                      <div className="paper-shadow-sm border border-line bg-surface-raised p-2.5 text-center">
                        <div className="font-mono text-lg tabular-nums text-accent-2">{liveTallies.booksUpdated}</div>
                        <div className="mt-0.5 font-sans text-[10px] text-ink-soft uppercase">Updated</div>
                      </div>
                      <div className="paper-shadow-sm border border-line bg-surface-raised p-2.5 text-center">
                        <div className="font-mono text-lg tabular-nums text-[var(--pill-reserved-fg)]">{liveTallies.booksSkipped}</div>
                        <div className="mt-0.5 font-sans text-[10px] text-ink-soft uppercase">Skipped</div>
                      </div>
                    </div>
                  </>
                )}

                <div className="mb-1 font-mono text-[9.5px] tracking-[.07em] text-ink-soft uppercase">People</div>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <div className="paper-shadow-sm border border-line bg-surface-raised p-2.5 text-center">
                    <div className="font-mono text-lg tabular-nums text-ok">{liveTallies.peopleNew}</div>
                    <div className="mt-0.5 font-sans text-[10px] text-ink-soft uppercase">New</div>
                  </div>
                  <div className="paper-shadow-sm border border-line bg-surface-raised p-2.5 text-center">
                    <div className="font-mono text-lg tabular-nums text-accent-2">{liveTallies.peopleMatched}</div>
                    <div className="mt-0.5 font-sans text-[10px] text-ink-soft uppercase">Matched</div>
                  </div>
                </div>

                <p className="text-center font-sans text-xs text-ink-faint">
                  Please keep this tab open until the import finishes.
                </p>
              </>
            ) : (
              <>
                <h2 className="mb-1 font-display text-2xl font-semibold text-ink">Confirm import</h2>
                <p className="mb-5 font-sans text-sm text-ink-soft">Here&rsquo;s what this file will do before anything is written.</p>

                {summary.books && (
                  <>
                    <div className="mb-1 font-mono text-[9.5px] tracking-[.07em] text-ink-soft uppercase">Books</div>
                    <div className="mb-2 grid grid-cols-3 gap-2">
                      <div className="paper-shadow-sm border border-line bg-surface-raised p-3 text-center">
                        <div className="font-mono text-xl text-ok">{summary.books.newCount}</div>
                        <div className="mt-0.5 font-sans text-[11px] text-ink-soft uppercase">New copies</div>
                      </div>
                      <div className="paper-shadow-sm border border-line bg-surface-raised p-3 text-center">
                        <div className="font-mono text-xl text-accent-2">{summary.books.updatedCount}</div>
                        <div className="mt-0.5 font-sans text-[11px] text-ink-soft uppercase">Matched &amp; updated</div>
                      </div>
                      <div className="paper-shadow-sm border border-line bg-surface-raised p-3 text-center">
                        <div className="font-mono text-xl text-[var(--pill-reserved-fg)]">{skippedBooksTotal(summary.books)}</div>
                        <div className="mt-0.5 font-sans text-[11px] text-ink-soft uppercase">Skipped</div>
                      </div>
                    </div>
                    {skippedBooksTotal(summary.books) > 0 && (
                      <p className="mb-3 rounded-[2px] bg-[var(--pill-reserved-bg)] px-3 py-2 font-sans text-sm text-[var(--pill-reserved-fg)]">
                        {booksSkipNoteText(summary.books)}
                      </p>
                    )}
                  </>
                )}

                <div className="mb-1 font-mono text-[9.5px] tracking-[.07em] text-ink-soft uppercase">People</div>
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <div className="paper-shadow-sm border border-line bg-surface-raised p-3 text-center">
                    <div className="font-mono text-xl text-ok">{peopleNewDisplay}</div>
                    <div className="mt-0.5 font-sans text-[11px] text-ink-soft uppercase">New people</div>
                  </div>
                  <div className="paper-shadow-sm border border-line bg-surface-raised p-3 text-center">
                    <div className="font-mono text-xl text-accent-2">{peopleMatchedDisplay}</div>
                    <div className="mt-0.5 font-sans text-[11px] text-ink-soft uppercase">Matched people</div>
                  </div>
                </div>
                {peopleCaption && <p className="mb-3 font-sans text-xs text-ink-faint italic">{peopleCaption}</p>}
                {summary.people && (summary.people.skippedMissingName > 0 || summary.people.emailConflicts > 0) && (
                  <p className="mb-3 rounded-[2px] bg-[var(--pill-reserved-bg)] px-3 py-2 font-sans text-sm text-[var(--pill-reserved-fg)]">
                    {peopleSkipNoteText(summary.people)}
                  </p>
                )}
                {error && <p className="mb-3 font-mono text-xs text-accent">{error}</p>}

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={onBackFromConfirm} className={btnGhost}>
                    Back
                  </button>
                  <button type="button" onClick={onConfirmImport} className={btnPrimary}>
                    {hasBooksFile ? "Import" : "Import people"}
                  </button>
                </div>
              </>
            )}
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
            {summary.books && (
              <p className="mb-2 font-sans text-sm text-ink-soft">
                <strong className="text-ink">{summary.books.newCount}</strong> new{" "}
                {summary.books.newCount === 1 ? "copy" : "copies"} added,{" "}
                <strong className="text-ink">{summary.books.updatedCount}</strong> matched by Copy ID and updated,{" "}
                <strong className="text-ink">{skippedBooksTotal(summary.books)}</strong> skipped.
              </p>
            )}
            {summary.books && skippedBooksTotal(summary.books) > 0 && (
              <p className="mb-3 rounded-[2px] bg-[var(--pill-reserved-bg)] px-3 py-2 font-sans text-sm text-[var(--pill-reserved-fg)]">
                {booksSkipNoteText(summary.books)}
              </p>
            )}
            <p className="mb-3 font-sans text-sm text-ink-soft">
              <strong className="text-ink">{peopleNewDisplay}</strong> new {peopleNewDisplay === 1 ? "person" : "people"} added,{" "}
              <strong className="text-ink">{peopleMatchedDisplay}</strong> matched
              {hasPeopleFile ? " and updated" : ""}. {summary.books ? "Everything else in your library was left untouched." : ""}
            </p>
            {summary.people && (summary.people.skippedMissingName > 0 || summary.people.emailConflicts > 0) && (
              <p className="mb-3 rounded-[2px] bg-[var(--pill-reserved-bg)] px-3 py-2 font-sans text-sm text-[var(--pill-reserved-fg)]">
                {peopleSkipNoteText(summary.people)}
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
