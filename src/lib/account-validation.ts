/**
 * Shared between the account/signup forms (live client-side feedback) and their API routes
 * (the authoritative check) so the two can never drift apart. See CLAUDE.md's "Usernames and
 * profile" note for why these specific rules exist.
 */

export function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  const checks = passwordChecks(password);
  return checks.length && checks.number && checks.special;
}

/** No quote characters anywhere; exactly one "@"; a letter before the following "."; a letter after it. */
export function isValidEmailShape(email: string): boolean {
  if (email.includes('"')) return false;
  const at = email.indexOf("@");
  if (at <= 0) return false;
  if (email.indexOf("@", at + 1) !== -1) return false;
  const domain = email.slice(at + 1);
  const dot = domain.indexOf(".");
  if (dot <= 0) return false;
  const before = domain.slice(0, dot);
  const after = domain.slice(dot + 1);
  return /[a-zA-Z]/.test(before) && /[a-zA-Z]/.test(after);
}

const USERNAME_PATTERN = /^[a-z0-9_-]{3,32}$/;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(username));
}
