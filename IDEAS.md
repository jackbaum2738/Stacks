# Ideas backlog

Things worth doing later, captured so they don't get lost. Not scheduled —
move an item into an actual task when it's time to build it.

## People directory for reservations

Right now "reserved for" is a free-text field with autocomplete against
previously-used names. Turn that into a proper directory instead:

- A "People" tab/page listing everyone books have ever been reserved for.
- The reservation form becomes a picker from that list, rather than a text
  field with suggestions.
- Still be able to add a brand new person directly from the reservation
  form, without leaving it, for the common case of reserving for someone
  new.

This would likely mean promoting "reserved for" from a plain string on
`Reservation` into a real `Person` model scoped to a library, with
`Reservation` pointing at it by id.

## Transactional email

There's currently no email provider set up (see CLAUDE.md) — invites are link-only,
not emailed, and there's no email verification on signup. If that's ever wanted:

- **Resend** is the best fit for this app's scale — built for Next.js/Vercel, simple
  API, and its free tier (3,000 emails/month, 100/day) is far more than a personal
  family library app would ever need. Requires a verified sending domain for
  anything beyond their shared test domain.
- Alternatives if Resend doesn't fit: **Brevo** (300/day free, no Next.js-specific
  tooling) or **AWS SES** (near-free per email, but more setup friction — sandbox
  mode and domain verification before it can send to arbitrary addresses).

## CSV import / export

A bulk way to get books into (and out of) a library, instead of scanning one ISBN
at a time. Two directions:

- **Export**: download a library's current copies as a CSV — title, authors,
  ISBN, shelf, status, reserved-for/contact, date added, BookCrossing ID, etc.
  Useful for backups, spreadsheet analysis, or just having an offline copy.
- **Import**: upload a CSV to bulk-create copies (and shelves/books as needed)
  instead of scanning each one in. Real use case that prompted this: instead of
  asking Claude to seed a library directly against the production database
  (which it can't safely do without real prod credentials, and which the CSV
  approach avoids entirely) — generate a CSV of realistic test data and import
  it through this feature instead, using the exact same path a real bulk-load
  would use.

Would need a defined column schema (probably matching the export format, so
export → edit in a spreadsheet → re-import round-trips cleanly), validation/error
reporting for bad rows (invalid ISBN, unknown shelf name, etc.), and a decision
on whether import matches existing books by ISBN (reusing the shared `Book`
catalog row, consistent with how scan-in already works) or always looks them up
fresh.

## Light / dark / system theme setting

The app already fully supports light and dark mode (it follows the
system/browser preference throughout), but there's no in-app control to
override that. Add a theme preference to Settings — Light / Dark / Match
system — stored per user (or per library?) so it persists across visits
regardless of what the OS is set to.
