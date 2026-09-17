/**
 * Column order for both the books half of the library export and its import template —
 * keeping these in one place is what makes export -> edit in a spreadsheet -> re-import
 * round-trip cleanly. "Date Added" is informational only; it has no matching import target
 * field (see TARGET_FIELDS in the import UI), so a re-imported row never tries to set it.
 * "Reserved For Person ID" is what actually links a row to the right Person once two
 * people can share a name -- "Reserved For" alone stays for a human skimming the file.
 */
export const BOOKS_EXPORT_COLUMNS = [
  "Copy ID",
  "ISBN",
  "Title",
  "Authors",
  "Publisher",
  "Shelf",
  "Status",
  "Reserved For",
  "Reserved For Person ID",
  "Notes",
  "BookCrossing ID",
  "Date Added",
] as const;

/** Column order for the people half of the export/import -- see BOOKS_EXPORT_COLUMNS. */
export const PEOPLE_EXPORT_COLUMNS = ["Person ID", "Name", "Email", "Phone", "Location", "Birthday"] as const;

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsvRow(values: (string | number | null | undefined)[]): string {
  return values.map((v) => csvEscape(v === null || v === undefined ? "" : String(v))).join(",");
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  // CRLF line endings and a leading UTF-8 BOM so the file opens correctly (accented
  // author names, etc.) when double-clicked into Excel, not just when re-imported here.
  return "﻿" + rows.map(toCsvRow).join("\r\n") + "\r\n";
}

/**
 * A small isomorphic CSV parser (used both by the browser-side import UI and, in
 * principle, anywhere server-side). Handles quoted fields containing commas, quotes
 * (doubled) and embedded newlines. Not a full RFC 4180 implementation, but matches
 * what any spreadsheet app actually writes.
 */
export function parseCsv(rawText: string): string[][] {
  const text = rawText.charCodeAt(0) === 0xfeff ? rawText.slice(1) : rawText;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
