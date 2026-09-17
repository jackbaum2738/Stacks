# Ideas backlog

Things worth doing later, captured so they don't get lost. Not scheduled —
move an item into an actual task when it's time to build it.

## "Export people" button on the People tab

The full backup zip now always includes `people.csv`, but there's no
lightweight way to export *just* the directory (no books, no zip) for
someone who only wants to bulk-edit contact details in a spreadsheet. Add a
one-click "Export people" button on the People tab itself that downloads a
bare `people.csv` -- same shape as the file inside the zip, just without the
books half or the zip wrapper. Raised as an open question during the People
directory build and left for later rather than assumed.

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

## Profile screen (own-account management)

There's currently no page for managing your own account — only the library-
level Settings page (shelves, members, delete library). Add one covering:

- Change email and password.
- Edit other personal details (whatever we end up tracking on `User`).
- Delete your own account.

Deleting your own profile needs a safety check: if you're the only member of
a library (checked per library you belong to), deleting your account would
orphan it, so the confirmation must say the library will be deleted too, and
only on confirming does it delete the user and that library together. If you
belong to a library with other members, your account can just be removed
from it (existing membership-removal semantics) without touching the library.

## Better error for a dead invite link

Using an invite link whose library was deleted, or whose invite code was
regenerated (so it no longer matches any library), currently isn't handled
with a friendly message. It should say the library doesn't exist/can't be
found, and suggest contacting the library owner for a new invite link,
instead of a generic error or a confusing state.

