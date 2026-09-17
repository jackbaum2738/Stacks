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

## Delete your own account

The Profile screen (PR #28) covers changing your name, username, email, and
password, but not deleting the account itself — deferred deliberately so that
PR stayed focused. Needs a safety check: if you're the only member of a
library (checked per library you belong to), deleting your account would
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

