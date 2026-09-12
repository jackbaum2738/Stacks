/** Strips whitespace/dashes and keeps only digits and a trailing X (ISBN-10 check digit). */
export function cleanIsbn(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^0-9X]/g, "");
}

export function isValidIsbn(isbn: string): boolean {
  return /^\d{9}[\dX]$/.test(isbn) || /^\d{13}$/.test(isbn);
}

/** Converts an ISBN-10 to its ISBN-13 equivalent. Returns the input unchanged if it's already 13 digits. */
export function toIsbn13(isbn: string): string {
  if (/^\d{13}$/.test(isbn)) return isbn;
  if (!/^\d{9}[\dX]$/.test(isbn)) return isbn;

  const core = "978" + isbn.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < core.length; i++) {
    const digit = Number(core[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return core + checkDigit;
}
