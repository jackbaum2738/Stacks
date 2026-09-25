@AGENTS.md

# Stacks — project history & working agreements

This section is project memory, not framework boilerplate — read it at the start of
every session before making changes. It exists because this project spans many
sessions with different context windows; it should be kept up to date (see "Keeping
this file current" at the bottom) rather than left to drift.

## What this app is

Stacks is a home library management app for the user's dad, replacing a Google
Sheets + Apps Script tool he built himself. He tracks roughly 200 books across ~25
physical shelves, scans ISBNs in and out, and reserves books for people in an
informal international book-sharing network before mailing them out (reserving
first saves postage — you don't want to mail a book that's already spoken for, or
fail to mail one that is).

Core real-world workflow the app exists to support: scan a book in → it sits on a
shelf → someone in the network wants it → reserve it for them → eventually mail it
→ scan it back out (removed from the library). A single physical copy can go
through reserve → release → reserve-again cycles multiple times over its life if
plans change, so that cycle has to actually work (see the reservation bug below —
it didn't, for a while).

## Tech stack & non-obvious framework facts

- **Next.js 16** (App Router, Turbopack) — this is newer than training data and has
  real breaking changes. `AGENTS.md` (imported into this file via `@AGENTS.md`
  above, auto-managed by `next dev` — see its own contents) tells you to read
  `node_modules/next/dist/docs/` before writing code. Do that; don't assume
  Next.js conventions from memory. Concrete breaking changes hit in this project:
  - `middleware.ts` → `proxy.ts` (the exported function is renamed `middleware` →
    `proxy`, Node.js-only runtime now).
  - `searchParams` on a page must be read via the `use()` hook on the
    `searchParams` prop, typed via `PageProps<'/route'>` (after running
    `npx next typegen`) — **not** by parsing `window.location.search` manually in
    a client component. Doing the latter caused a real, production-observed bug
    (stale values after client-side `<Link>` navigation) because Next 16's router
    caching doesn't guarantee a fresh read there.
  - Route param types (`RouteContext<'/api/...'>`, `PageProps<'/...'>`) come from
    generated types. If `tsc` complains a new route's `PageProps`/`RouteContext`
    type "does not satisfy the constraint", run `npx next typegen` — it's not
    stale until you do.
- **Prisma 6.19.3**, deliberately pinned — `npm i`'s default at the time was a
  `8.0.0-rc` release candidate, which we do not want. Don't "helpfully" upgrade it.
  `directUrl` is split from the pooled `DATABASE_URL`: pooled (Neon `-pooler`) for
  the app, direct/unpooled for `prisma migrate`.
- **Custom auth** — bcryptjs for password hashing, `jose` for JWT session cookies.
  No NextAuth. Which library is "active" is resolved from the URL itself (a `/{code}/...`
  path segment), not a cookie — see "Library-code URL routing" under "Data model" below;
  the note this replaced described a since-removed `stacks_active_library` cookie.
- **Tailwind CSS v4**, dark mode via CSS custom properties re-defined under
  `@media (prefers-color-scheme: dark)`, plus a Settings → Appearance switcher
  (PR #16) that can override the OS preference: it sets `data-theme="light"` /
  `"dark"` on `<html>` (via `localStorage["stacks:theme"]`, read by a small
  blocking inline script in `layout.tsx` so there's no flash of the wrong
  theme), or clears the attribute for "System". `globals.css` has three
  layers to keep in sync when touching theming: the base `:root` block
  (light values), `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }`
  (OS-driven dark, unless overridden to light), and `:root[data-theme="dark"]`
  (explicit dark, regardless of OS) — same variable list duplicated across
  the last two. Tailwind's own `dark:` variant (rare in this codebase —
  `book-cover.tsx` and `full-logo.tsx` are the only users) defaults to OS-preference-only in v4, so
  it's redefined via `@custom-variant dark` at the top of `globals.css` to
  also respect the `data-theme` attribute — don't add a `dark:` class
  anywhere without checking that redefinition still covers it.
- **Visual identity: "Ex Libris"** (PR #4/#5, replacing the unmodified Next.js
  starter look). Archival/manila palette — paper surfaces, ink text, a stamp-red
  `accent` and teal `accent-2` — as CSS custom properties + Tailwind `@theme`
  tokens in `src/app/globals.css` (`bg`, `surface`, `ink`, `ink-soft`, `line`,
  etc.). Light and dark are both first-class, defined separately, never a
  mechanical inversion of each other. Typography: Newsreader (display/titles),
  Karla (interface/body), IBM Plex Mono (labels, dates, ISBNs, status pills),
  self-hosted via `next/font/google`. 2px radius everywhere and a flat "stacked
  paper" box-shadow (`.paper-shadow-*` classes, no blur) on cards/stat tiles are
  the signature. Shared form-field styling lives in `src/lib/form-styles.ts`
  (`formLabelClass`/`formInputClass`) — reuse it for any new form rather than
  redefining the underline-input look inline. Favicon is generated SVG/PNG
  (`src/app/icon.svg`), not hand-drawn. The icon-only `Mark` (`src/components/mark.tsx`)
  still exists for standalone-icon spots (the privacy page, `MarkLoader`'s animated bars) but
  **the icon+"Stacks" wordmark lockup is a single flattened PNG, not live SVG+text** — see
  "Full logo asset" below (PR #44).
- **Full logo asset** (`src/components/full-logo.tsx`'s `FullLogo`, PR #44) is the *only* place
  the site header, dashboard header, site footer, the `Wordmark` component (auth pages), and
  the transactional email template get the "Stacks" icon+wordmark lockup from — each of those
  five previously recreated `<Mark size={N} /> Stacks` inline, by hand, which is exactly why a
  footer icon-size bump (PR #36) could leave the text stuck at its old size next to it, and why
  the email's separately-hand-built div/table version could drift out of sync (wrong font,
  wrong layout) without anyone touching the app's own header at all. Jack produced the
  replacement asset himself in Claude Design (light-background and dark-background PNG
  variants, `public/logo-full-light.png` / `logo-full-dark.png`) and approved it before it was
  wired in. `FullLogo` picks the right variant via the same `dark:` custom variant the rest of
  the app uses (`book-cover.tsx` was the only other user before this) — **if you ever add a
  sixth place this lockup should appear, use `<FullLogo height={N} />`, never rebuild it from
  `Mark` + text again.** The email template (`src/lib/emails/shared.ts`) always uses the light
  variant via a plain `<img>` tag, since email stays light-only (see the email design note
  below) and a real image sidesteps the email-client CSS inconsistencies that caused the Gmail
  bug in the first place.
- **Site footer** (`src/components/site-footer.tsx`, PR #35, logo swapped to `FullLogo` in
  PR #44) is wired into the root `layout.tsx`, not the dashboard layout, so it renders on every
  page including the logged-out landing page, login/register, and `/join/[code]` — every
  top-level page wrapper in this codebase already carries `flex-1` (a deliberate existing
  pattern), so a global footer sibling after `{children}` sits at the bottom of short pages
  without any per-page change. Shows the logo (linked to `/dashboard`), a `/privacy` link, a
  copyright line, and the running version, read straight from `package.json` via a JSON import
  (`resolveJsonModule` is already on in `tsconfig.json`) rather than hand-maintained — bump the
  version there as usual and the footer follows automatically.
- **Mobile navigation shell** (`src/components/mobile-nav.tsx`, PR #41) — below the `sm`
  breakpoint the desktop top tab strip (`nav-tabs.tsx`) and the header's name text
  (`profile-menu.tsx`) are hidden (`hidden sm:flex`/`hidden sm:inline`) and replaced by a fixed
  bottom tab bar: Scan, Library, People, plus a "More" button that slides up a sheet with
  Overview, Shelves, Settings (originally also had Reservations — removed by the
  concurrently-merged PR #42 fold into People, see "PR history" below). This was a deliberate
  choice over other options mocked up (a hamburger drawer, a horizontally-scrollable tab strip)
  — Jack picked the bottom bar as "probably the best option" for a phone-first library app. Its
  bottom padding uses `env(safe-area-inset-bottom)`, which needs
  `viewport: { viewportFit: "cover" }` set in the root `layout.tsx`'s `Viewport` export to
  resolve at all on iOS — don't drop that export if touching viewport/meta config again, the
  bottom bar will sit under the home indicator without it. Jack's stated direction: build this
  as a PWA (no App/Play Store listing, so no developer license fees) rather than a native app
  for now, with a native wrapper only a possible future option. Don't assume every page has a
  mobile-specific layout yet — only Library, People, and the shared `CopyRow` (Shelf detail) got
  phone-width card layouts in PR #41; other pages just reflow within the new nav shell.
- **Standard loading takeover** (`LibraryLoadingOverlay` + `MarkLoader`, PR #34) is the one
  loading UI for any operation that does real server-side work with no per-step progress to
  show — library switch/create/delete today, account deletion next. Reuse it rather than
  inventing a new spinner or animation; only the `message`/`hint` text changes per case
  (Jack confirmed this explicitly when reviewing the delete-account mockup). CSV import's
  progress bar (see below) is the one exception, for the one case that has real per-batch
  progress to report — everything else without that gets this takeover instead.
- **Deployment**: Vercel + Postgres on Neon. `package.json`'s `build` script runs
  `prisma migrate deploy && next build`; `postinstall` runs `prisma generate`.

### Data model

Multi-tenant: `Library` ↔ `User` via `Membership` (role: OWNER/ADMIN/MEMBER). Anyone
can register and create their own brand-new `Library` (no invite needed for that path
— invites are only for *joining* an existing one), so different libraries are
genuinely unrelated strangers to each other, not just internal household divisions.
`Book` is a **shared global catalog** keyed by `isbn13` (unique) — the same ISBN
scanned into two different libraries reuses one `Book` row (the trusted, ISBN-lookup-
sourced data) rather than re-doing the lookup; each library gets its own `Copy` row
pointing at it. `Copy` has a `status` (AVAILABLE/RESERVED/REMOVED), an optional
`Reservation` (1:1 via `Reservation.copyId @unique`), and its own `bookCrossingId`
(a BookCrossing.com release ID identifies one physical copy, not a title/edition, so
it's per-`Copy`, never per-`Book`). Sharing a library between people uses a random
`Library.inviteCode` link, not email (no transactional email provider is set up —
see CHANGELOG 2.0.0).

**Library-code URL routing (PR #63, 2026-09-25) — key decisions if you touch this again:**
`Library.code` (`L-XXXXXX`, unique, generated at creation and backfilled for pre-existing
rows) is the public identifier the whole dashboard is now addressed by: every library page
lives at `/{code}/...` (e.g. `/L-7K3M9Q/library`) instead of the old `/dashboard/...`, and
every library-scoped API route lives at `/api/{code}/...` instead of `/api/library/...`,
`/api/copies/...`, `/api/people/...`, `/api/reservations/...`, `/api/shelves/...`, or
`/api/search`. This replaced a design where "which library is active" lived in a single
`stacks_active_library` cookie shared by every tab — switching libraries in one tab
silently changed what every other open tab pointed at. Jack's explicit ask: he wanted
multiple libraries open in different browser tabs at once, which a shared cookie can never
support regardless of how carefully it's synced, so the fix had to put the library identity
in something tab-scoped by nature — the URL — not patch the cookie approach further.
- **`getLibraryByCode(code)`** (`src/lib/auth.ts`) is the sole authorization path for every
  `/{code}/...` page: it checks the code against the signed-in user's own memberships and
  returns a discriminated union — `unauthenticated` (redirect to login), `forbidden` (the
  code doesn't exist, or isn't one of your memberships), or `ok` (with the resolved
  membership/library). `forbidden` renders a plain "You don't have access to this library"
  message rather than silently redirecting into a different library — a stale or mistyped
  code has to be obvious, never a silent bounce. `requireLibraryContext(libraryCode, options)`
  (`src/lib/api-context.ts`) is the equivalent for API routes, taking the code from the
  route's own `[libraryCode]` param — **never a cookie**. Don't reintroduce a cookie-based
  fallback for either; that's exactly the shared-mutable-state this PR removed.
- **The old `stacks_active_library` cookie and `POST /api/library/switch` are gone
  entirely**, along with the cookie-based `getCurrentLibrary()` they backed. In their place,
  `stacks_last_library` (`LAST_LIBRARY_COOKIE`) stores the last-visited library's *code* and
  is purely advisory — set by `proxy.ts` on every `/{code}/...` visit, read only by
  `getDefaultLibraryCode(user)` to pick which library the bare `/dashboard` lobby and the
  Profile page's header chrome should point at next. It never authorizes anything; a stale
  or tampered value can misdirect that one redirect at worst, not grant access to a library
  you don't belong to.
- **No backward-compatible redirects from old `/dashboard/...` links** — dropped per Jack's
  explicit instruction ("get rid of the old links — nothing is bookmarked"). `/dashboard`
  itself still exists as a lobby, not a library page: it redirects a member straight to
  `/{their default library's code}` and still hosts the zero-membership create-library/
  invite-accept gate for an account with no library yet; `/dashboard/profile` is unchanged
  and library-independent, reachable with or without a membership.
- Every component that fetches or links to library-scoped data reads a `code` prop (or
  reads it from `LibraryRoleProvider`/`useLibraryRole()`, which now carries
  `{ role, code, canEdit, canManage, isOwner }`) rather than assuming one ambient active
  library — this is deliberate, not incidental plumbing: it's what makes each tab's fetches
  land on that tab's own library regardless of what any other open tab is doing.
  `LibrarySwitcher.selectLibrary` is a plain `router.push(`/${code}`)`; creating a library,
  accepting an invite, or deleting/emptying the current library each land on the right
  library's own code (or the `/dashboard` lobby) instead of a bare `router.refresh()`.
- Verified with a live local Playwright run: two independent browser contexts registered
  separately, each created its own library, and scanned a different book onto a different
  shelf at the same time — confirming each library's Settings page showed only its own
  shelf with zero cross-contamination between the concurrently-running tabs (the actual
  point of the feature); a signed-in user hitting another library's code got the "no
  access" message rather than being pulled into it; and the bare `/dashboard` lobby still
  redirected correctly. Test accounts/libraries/shelves/copies cleaned up afterward.

**People directory (PR: People tab).** `Reservation.reservedFor`/`contact` (plain strings)
were replaced by `Reservation.personId` pointing at a library-scoped `Person`
(`id, libraryId, name, email?, phone?, location?, birthday?, code`) — see
`src/components/person-combobox.tsx`/`person-modal.tsx`/`delete-person-modal.tsx` and
`/dashboard/people`. Only `name` is required; `email` is the **sole** field unique
per-library (`@@unique([libraryId, email])`, safe because nullable columns never collide
with each other in Postgres), so duplicate names are fully expected and never merged
automatically. `Person.code` ("P-XXXXXX", `src/lib/person-code.ts`) is the CSV
round-tripping key, same idea as `Copy.code`. Deleting a Person is always allowed even
mid-reservation (a Person isn't a user account) — any *active* reservation is released
(copy back to AVAILABLE) and deleted first, inside the same transaction as the Person
delete; a released/historical Reservation just has its `personId` nulled by
`onDelete: SetNull`, keeping history intact without blocking the delete. Person
add/edit/delete is Member+ (`canEdit`), one tier below shelf/settings management, since a
Person record carries no account access of its own.

`Copy.notes` (free text, 2000-char cap) is per physical copy, same reasoning as
`bookCrossingId` — two copies of the same ISBN can carry different notes. The field
and its `PATCH /api/copies/[id]` endpoint existed since the CSV import/export work
(PR #12) but sat unused in the UI until PR #19 gave it a manila-notecard UI
(`src/components/copy-notecard.tsx` on the book detail page,
`src/components/note-popup.tsx` for the quick-read/edit popup opened from the
corner tag on grid tiles and list rows in `/dashboard/library`). The manila color
tokens and the `.notecard-tape`/`.notecard-fold` pseudo-element classes live in
`globals.css` alongside the other signature look-and-feel classes — reuse them
rather than redefining the tape/fold effect if this UI grows.

**Book edits are library-scoped, never written to the shared `Book` row.** A
`BookOverride` row (unique per `bookId`+`libraryId`) holds one library's corrections
to title/authors/publisher/pageCount/description/coverUrl; display code merges it
over the canonical `Book` fields (`src/lib/book-view.ts`'s `applyBookOverride`),
falling back to canonical wherever a field is null (empty `authors` counts as
"not overridden" too, since Prisma list fields can't be nullable). **Don't ever
`prisma.book.update()` from user-facing edit code** — since `Book` is genuinely
global (reused by every library sharing that ISBN), writing there directly means
one library's bad edit corrupts what every other, unrelated library sees. This was
the actual bug in the first cut of book-editing (PR #6) — caught before merge.

**Important constraint to know about:** `Reservation.copyId` is `@unique`, so a
`Copy` can only ever have **one** `Reservation` row across its whole history
unless that row is deleted. This bit us once — see "Bugs found and fixed" below —
so if you're touching reservation code, releasing a reservation must delete the
row, not just flag it, or the copy becomes permanently unreservable.

**Roles and invite links (added in a later session, see PR history) — key decisions if you
touch this again:**
- Four tiers on `Membership.role`: OWNER (exactly one per library, enforced only by
  convention/application logic, not a DB constraint), ADMIN, MEMBER, VIEW_ONLY. Admin can do
  everything Member can, plus manage shelves, invite links, CSV import, and other members'
  roles/removal (not the Owner's). Member can scan/reserve/edit books but can't touch
  settings. View Only is read-only everywhere — can't scan, reserve, edit, or add notes.
  Checks live in `src/lib/permissions.ts` (`canEditLibrary` = Member+, `canManageLibrarySettings`
  = Admin+) and are applied via `requireLibraryContext({ require: "edit" | "manage" })` in
  `src/lib/api-context.ts` — always gate a new mutating route through one of those two rather
  than re-deriving a role check inline. Client components read the same capabilities from
  `LibraryRoleProvider`/`useLibraryRole` (`src/components/library-role-context.tsx`), set up
  once in the dashboard layout, so a client-fetched page (Scan, Library browse/grid) doesn't
  need its own role fetch.
- **Member is deliberately excluded from CSV import**, not just shelf management, because
  import auto-creates a `Shelf` row for any unrecognized shelf name in the file
  (`resolveShelfId` in the import route) — allowing Member to import would let them create
  shelves indirectly, defeating the "Member can't manage shelves" boundary. This was raised
  and confirmed with the user before building rather than assumed either way. Export stays
  available to Member (not View Only) since it's read-only content-wise, even though it does
  write `Library.lastBackupAt`/`lastBackupByUserId` as a side effect.
- **Superseded by emailed invites (see below) as of PR #50.** The three
  per-role invite-link columns this bullet originally described (`inviteCodeAdmin`/
  `inviteCodeMember`/`inviteCodeViewOnly`, `src/lib/invite-code.ts`) are gone — kept this note
  only so a stale reference to those names elsewhere in history makes sense.

**Emailed library invites (replaces the per-role invite links above) — key decisions if you
touch this again:** a `LibraryInvite` row (`libraryId`+`email` unique, `role`, `token`,
`lastSentAt`) replaces the three columns. An Admin+ enters one email and picks Admin/Member/
View Only from the new Open Invitations tab in Settings (`src/components/members-section.tsx`,
`send-invite-form.tsx`, `open-invite-row.tsx`); Stacks emails a one-time `/invite/[token]` link
via Brevo (`src/lib/emails/library-invite.ts`), reading "{inviter's username} invited you to
join {library}" per Jack's explicit wording. There is still deliberately no invite path to
Owner — transfer-ownership remains the only way anyone becomes Owner.
- **A row's mere existence *is* "open."** Cancel (`DELETE /api/library/invites/[id]`) and a
  successful Accept both delete the row outright rather than flagging it — same delete-not-flag
  pattern as Reservation release (see "Bugs found and fixed" below) — so a cancelled or
  already-accepted link immediately shows the existing "This link is no longer valid" message
  with nothing left to clean up later, and the Open Invitations tab is simply "every row here."
  Resend re-sends the same link and is rate-limited to once per 60 seconds *per invite*,
  enforced in `POST /api/library/invites/[id]/resend` itself (429), not just disabled in the
  UI, since two admins racing the button client-side wouldn't be caught otherwise.
- **Accepting is always a separate confirmation step after signing in, never instant on
  opening the link** — explicit spec from Jack. `/invite/[token]` sends a signed-out visitor to
  the existing sign-in/create-account choice; a signed-in visitor is redirected straight to
  `/dashboard?invite=token`. `InviteAcceptOverlay` reads that query param (via
  `useSearchParams()`, since a layout — unlike a page — never receives `searchParams` as a
  prop) and renders the "Join {library} as {role}?" popup two ways: as a dimmed backdrop *over*
  the normal dashboard for an existing account (`variant="overlay"`, mounted in the dashboard
  layout's has-library branch), or in place of the "create your first library" prompt for a
  brand-new account that registered through the same link (`variant="inline"`, via
  `ZeroLibraryContent` in the zero-membership branch) — per Jack's explicit "instead of the new
  library popup" instruction. This is why **registering via an invite no longer auto-joins**:
  `POST /api/auth/register` with an `inviteCode` just confirms the invite is still live and
  creates the account library-less on purpose, so the same accept popup (and the same
  `POST /api/invite/[token]/accept`, which creates the membership and deletes the invite in one
  transaction) handles a brand-new account exactly like an existing one clicking the link.
- **A `Membership` row with role OWNER can never be deleted or have its role changed** through
  the regular member-management endpoints (`/api/library/members/[id]`) — enforced
  server-side (409), not just hidden in the UI. The only way to stop being Owner is
  `/api/library/transfer-ownership` (Owner-only: hands OWNER to another member, demotes the
  caller to ADMIN in the same transaction). This means an Admin can never remove or demote
  the Owner by construction, and an Owner who wants to leave the library transfers first,
  then removes their own now-Admin membership like anyone else — there's no separate
  "Owner self-removal" code path.
- The migration that added View Only also **promoted every existing plain MEMBER to ADMIN**,
  since the old MEMBER role already had full read/write access (the pre-existing UI never
  exposed shelf/invite/member management to anyone but Owner, but nothing in the API stopped
  a MEMBER from hitting those routes directly before this change) — nobody's access shrank
  the moment this shipped. It also copied any already-shared single `inviteCode` into
  `inviteCodeAdmin` so an old link keeps granting the same access it always did.

**Wipe library (PR #22) — key decisions if you touch this again:**
- Complements full deletion rather than replacing it: `POST /api/library/wipe` clears every
  `Shelf`, `Copy`, and `Reservation` (Copy's Reservation cascades automatically) plus that
  library's `BookOverride` corrections, but leaves the `Library` row, memberships/roles, and
  all three invite links alone. Both actions live in one `DangerZoneSection` component under a
  single "Danger zone" heading in Settings, not a second settings row -- explicit instruction
  from Jack when this was proposed.
- **Wipe is Admin+ (`requireLibraryContext({ require: "manage" })`), Delete stays Owner-only.**
  Deliberately more permissive than delete: wipe can't touch membership or lock anyone out, so
  it's gated at the same tier as shelves/invites/import rather than reserved for the Owner.
  Agreed with Jack before building, same as the original role-tier decisions in PR #17.
  BookOverride rows for the library are deleted too (they'd otherwise be orphaned corrections
  for a catalog that no longer exists).
- Mocked up first as an Artifact; Jack's feedback dropped a "removed vs. kept" two-column list
  down to just a 2x2 "removed" count grid (copies, shelves, active reservations, book
  corrections), and swapped the wipe-succeeded message off the app's usual green -- felt too
  positive for a destructive action -- onto the amber already used for the "Reserved" status
  pill (`--pill-reserved-fg`) instead of introducing a new color.

**CSV backup/import (PR #12, #14) — key decisions if you touch this again:**
- **The real import runs as many small requests, never one big one (PR #14).**
  `src/components/backup-import-section.tsx` splits the file into batches of
  `IMPORT_BATCH_SIZE` (10) rows and calls `POST /api/library/import` once per
  batch, sequentially — each batch is its own `$transaction` that fully commits
  before the next batch is even sent. This is why closing the tab mid-import is
  merely incomplete rather than destructive: only the one batch in flight is
  ever at risk: everything before it already landed. Don't "simplify" this back
  into one request for the whole file — that was the original design and it had
  no way to show real progress and a real risk of a giant transaction dying
  entirely if the connection dropped before Vercel could return the response.
- **The progress bar/ticker on the confirm screen aren't fed live per-row
  network events** — they can't be, since progress only actually arrives once
  per batch. Instead each batch response includes a `rowResults` array (label +
  outcome per row, in input order — see the route), and the client reveals
  those rows to the UI one at a time from a queue, paced by
  `revealMsPerRowRef` — an estimate that adapts after every batch to that
  batch's own observed `elapsed / rowCount`, biased ~15% faster so the queue
  rarely empties while waiting on the next batch. This is what makes the UI
  read as continuously moving even though the underlying data is chunky; if
  you ever change the batch size or add real server-sent events instead, this
  reveal-pacing logic is what you'd revisit or remove.
- A batch request that fails outright (network error or non-2xx) does **not**
  mean nothing was imported — prior batches already committed. The confirm
  screen's error message says how many of the file's rows made it in before
  stopping and that re-running the same file is safe (Copy-ID-matched rows
  just re-match harmlessly) — don't revert this to a generic "nothing was
  changed, try again" message, since that would now be false.
- **`IMPORT_BATCH_SIZE` (10) and the reveal-pacing estimate are tuned for an
  assumed, not yet confirmed, ~2-minute/200-row real-world import.** Every
  test so far (Playwright against local Postgres) has processed even a few
  dozen rows near-instantly — much faster than production's pooled Neon
  connection is likely to be. If the user reports real timing from an actual
  large import (their planned manual QA pass — see "Scope notes" below),
  that's the moment to revisit whether 10 is still the right batch size, not
  before.
- Import never calls the external ISBN lookup itself. A brand-new ISBN just gets a
  bare `Book` placeholder marked `source: "manual-unresolved"` (the same marker
  scan-in's failed-lookup path already uses), because a multi-row import hitting
  Google Books/Open Library synchronously is exactly the kind of thing that already
  caused a production timeout once for a *single* scan-in (see "Bugs found and
  fixed"). Resolution happens later, either automatically (scan-in already retries
  any `manual-unresolved` book on its next scan, anywhere) or manually (see below).
- Import matches rows to existing copies **by Copy ID, not ISBN** — a library can
  own more than one physical copy of the same ISBN, so ISBN alone can't tell two
  copies apart. A row with no Copy ID, or one this library doesn't recognize,
  always creates a new `Copy`; only an exact Copy ID match updates one in place.
  The export's "Copy ID" column exists specifically to make export → edit →
  re-import idempotent.
- The import confirm screen's new/updated/skipped counts come from a real
  server-side dry run (`POST /api/library/import` with `dryRun: true`, same
  Copy-ID/ISBN-validation logic, zero writes) rather than a client-side estimate —
  the client can't know which Copy IDs are real without asking the server.
- `Book.manualLookupAttempts` caps the "Look up this ISBN" button on the edit page
  at 1 manual attempt (`MAX_MANUAL_LOOKUP_ATTEMPTS` in `src/lib/books.ts`) so it
  can't be spammed on a book that just isn't in either catalog. This is deliberately
  **separate from and doesn't limit** scan-in's own automatic retry — that only
  ever fires once per real physical scan and can't be spammed the same way, and the
  external catalogs do keep growing, so it should keep trying forever.
- That same button, on success, deletes this library's `BookOverride` for the book
  instead of leaving it in place. An override always wins over the canonical `Book`
  in the merged view, so if a library had already saved its own correction for a
  still-unidentified book, a successful lookup would otherwise be invisible and the
  button would look broken. Chosen deliberately over the alternative (hiding the
  button once an override exists), which would permanently lose the option after
  any test/throwaway save.

**Backup/import as a zip of two files (People tab PR) — key decisions if you touch this
again:**
- `GET /api/library/export` and `/api/library/import-template` now return a `.zip`
  (`src/lib/backup-zip.ts`'s `createZip`/`readZip`, isomorphic JSZip) containing
  `books.csv` + `people.csv`, not one flat CSV. A person-per-copy-row export can only
  ever list people who currently hold a book, so `people.csv` is built from a plain
  `prisma.person.findMany`, independent of any reservation — someone with zero active
  reservations is never dropped. Column lists live in `src/lib/csv.ts` as
  `BOOKS_EXPORT_COLUMNS`/`PEOPLE_EXPORT_COLUMNS`.
- **`src/components/backup-import-section.tsx` accepts a `.zip`, or either
  `books.csv`/`people.csv` on its own** — it sniffs the filename first, then the header
  shape (`detectFileKind`), rather than requiring a specific upload flow. A zip runs
  its mapping wizard one file at a time (books, then people — same order the old
  single-CSV wizard used for its one step), both steps saying "Continue"; the real
  import then runs **people first, then books**, the opposite order, so a books row
  carrying a Person ID from the same backup can match it exactly as soon as that
  person exists rather than falling back to a name guess.
- **Person-resolution rule, mirrors Copy ID exactly (`/api/library/import`'s
  `resolvePerson`):** a `books.csv` row's "Reserved For Person ID" is checked first —
  if it matches an existing Person in this library, that Person is used outright; if
  it's present but *doesn't* match anyone, a new Person is created (never falls back to
  guessing by name), same as an unrecognized Copy ID always creating a new Copy rather
  than merging into an existing one. Only a **blank** Person ID cell falls back to
  matching "Reserved For" by name: no match creates a Person (mirrors an unrecognized
  shelf name auto-creating a Shelf), exactly one match reuses them, and **two or more
  matches always creates a new Person** rather than guessing which one — this last
  rule only exists because Person names, unlike Shelf names, are allowed to duplicate.
  `/api/library/import-people` (standalone `people.csv`) is Person-ID-only with no
  name/email fallback at all, exactly like Copy ID — an unrecognized or blank ID always
  creates new, since matching by name or email here would silently merge two different
  people or two different inboxes.
- The import wizard's mapping/confirm/in-progress/results screens all render Books
  and/or People sections depending on what was actually uploaded (zip vs. books-only vs.
  people-only) rather than one fixed layout — see `ImportSummary`/`hasPeopleFile` in
  `backup-import-section.tsx`. A books-only import's People tally comes from
  `peopleNewCount`/`peopleMatchedCount` on the books route's own response (people
  implied by "Reserved For"); a people-file-present import (zip or people-only) uses
  the people route's own counts instead — a books-only completion message never says a
  matched person was "updated", since `books.csv` never touches a matched person's own
  contact fields.

**Usernames and profile (PR #30, made required in PR #32) — key decisions if you touch this again:**
- `User.username` was nullable + unique for one release (PR #30 shipped it that way even though
  every new signup already required one) because that migration landed against real production
  accounts (Jack's two) that predated usernames. Jack's plan, agreed before building: set a
  username on each from the new Profile page, then a follow-up migration makes the column
  `NOT NULL`. He confirmed both were set on 2026-09-17 and PR #32 made the column required —
  `username` is now `String @unique` in the schema, not `String?`, and every component/route
  treats it as always-present (no more `username ?? "Not set"` or `?? email` fallback anywhere).
  If you're reading this before PR #32 merged, expect the nullable version instead.
- Sign-in takes one `identifier` field (email or username, both compared lowercased) instead of
  a dedicated `email` field — `POST /api/auth/login` looks up `WHERE email = ? OR username = ?`.
  Username is always stored lowercased (`normalizeUsername` in `src/lib/account-validation.ts`),
  so the comparison never needs case-insensitive matching at the DB level.
- **Changing your name never requires re-entering your password; username, email, and password
  all do.** Explicit distinction from Jack: a display name carries no login or account-recovery
  risk if changed by whoever already has the session open, so `PATCH /api/account/name` skips
  the check the other three routes require. The re-auth popup (`src/components/reauth-modal.tsx`)
  is shared across all three and dismisses the same way Cancel does if you click outside it.
- **You can't "reveal" your current password, even after re-authenticating** — the app only
  ever stores a bcrypt hash, never the plaintext, so there's nothing behind the masked dots to
  show. Raised directly with Jack during the mockup round; agreed fix was to drop the
  visibility toggle from the static Password row entirely and keep it only on the *new*
  password fields in the change-password panel, which do hold a real typed value.
  Re-authentication still gates opening nothing (the change-password panel opens freely) but
  gates every Save.
- Password strength (at least 8 characters, a number, a special character) and email shape (an
  "@", a letter before the following ".", a letter after it, no quote characters anywhere) are
  both defined once in `src/lib/account-validation.ts` and imported by every form (sign-up,
  profile) and every route (`register`, `account/email`, `account/password`) — client-side
  checks are for the live checklist/gating UX only; the server re-validates from the same
  functions as the actual authority. Don't duplicate these rules inline anywhere else.
- The username `Change` panel checks availability (`GET /api/account/username/available`, a
  plain UX convenience) *before* opening the re-auth popup, per Jack's explicit ask — a taken
  username should never make you type your password first only to be told to pick another one.
  The `PATCH` route re-checks uniqueness itself regardless, since two tabs racing each other is
  still possible.
- Email changes require typing the new address twice (no confirmation email exists to catch a
  typo otherwise); sign-up now does the same for the same reason. Both reuse the identical
  match-check pattern already used for the two new-password fields.
- Built through five rounds of an Artifact mockup before any code was touched (interaction
  details worth remembering if the UI changes again): the two "Change" interaction styles
  Jack asked to compare (inline tinted panel vs. a popup dialog) were both prototyped live in
  the mockup; he picked the inline panel. The reauth/save button reads "Confirm", not
  "Confirm & save". The per-field "Editing…" eyebrow label from an early round was cut as
  unnecessary once the tinted panel + left accent bar made the editing state clear on its own.

**Library list pagination — key decisions if you touch this again:** `/api/search` used to
truncate its response (50 rows for a text query, 300 for browsing everything) before any
pagination existed; that cap is now removed entirely — the route returns every matching
row and `src/app/dashboard/(library)/library/page.tsx` slices it into pages client-side, the same
place it already does client-side sorting/filtering over the one fetched result set. A
picker (25/50/100/200, default 25) sits above the list/grid; a Prev/Next + numbered pager
(windowed around the current page, not every page number) appears below the results only
once there's more than one page. State rules, all per Jack's explicit spec: changing page
size or re-running search/sort resets to page 1 (the result set just changed under you);
paging with Next/Prev never touches the page size (this was the actual bug reported — with
no pagination yet, there was no defined behavior for "page forward at 200" at all); List ↔
Grid keeps both the current page and size, since it's the same results only displayed
differently. The chosen page size persists across visits via `localStorage`
(`stacks:library-page-size`, same pattern as the existing `stacks:library-view-mode` key)
— the current page itself is never persisted and always starts at 1 on a fresh visit, since
a remembered mid-list page number wouldn't mean anything against a result set that may have
changed since. Mocked up first as an Artifact (one round of feedback: Jack asked to drop the
"Show" label next to the page-size numbers) before any code was touched.

**Reservations folded into People, no standalone tab (project thread, 2026-09-18) — key
decisions if you touch this again:** the Reservations nav item and `/dashboard/reservations`
page are gone. A reservation only exists so that mailing several books to the same person
abroad in one parcel is cheaper than mailing them one at a time — Jack's explicit correction
mid-build — **not** to track what's been sitting the longest, and nothing ships until there's
enough reserved for that person to make the postage worth it. That rules out any "oldest
first" / "held N+ days" framing: an early mockup round pitched Reservations as an age-sorted
shipping queue, which Jack rejected on exactly this premise, not on the UI. The People table's
"N active" count (`src/app/dashboard/people/page.tsx`) is now the only entry point — clicking
it opens `ReservedOverlay` (`src/components/reserved-overlay.tsx`), a full screen (not a
slide-over) listing every active reservation in the library, sortable by Book/Reserved
for/Shelf/Reserved on the same click-header pattern as the People and Library tables. The
filter box defaults to whichever person's count was clicked but stays editable, so clearing it
browses every reservation at once — that's also what makes column sorting worth having, per
Jack. Only two row actions: Edit (reassign who a copy's reserved for, via the existing
`ReservationModal` in edit mode) and Release (plain `PATCH /api/reservations/[id]` with
`release: true`, same delete-the-row behavior as everywhere else — see the reservation-release
bug under "Bugs found and fixed"). A "Mark as sent" action was in the first build round but
cut before merge: what should actually happen to a copy once it's mailed out (scanned/removed
like today's manual Remove, or its own trackable status) hasn't been designed, so it's an
IDEAS.md item and this screen only offers Release for now. Mocked up first as an Artifact,
two rounds — round one offered three directions (fold into People; an age-sorted "ready to
ship" queue, recommended at the time; a merged People/Reservations page with two views) before
Jack corrected the batching premise and picked "option 1 with elements of 2."

**Password reset & transactional email (Brevo) — key decisions if you touch this again:**
Came out of buying stacksonline.com and setting it up for email deliverability (SPF, DKIM,
DMARC, a branded `mail` subdomain) in a project-thread session — see that thread for the full
Cloudflare/Brevo DNS setup if it ever needs redoing. `src/lib/brevo.ts` sends via Brevo's HTTP
API (not SMTP) from `noreply@stacksonline.com`, reading `BREVO_API_KEY` from the environment;
with no key set it logs the plain-text email body to the console instead of throwing, so local
dev and the sandbox's Playwright runs can still follow a reset link without a real Brevo
account. **`PasswordResetToken` stores only a SHA-256 hash of the raw token, never the token
itself** — a database leak alone can't be replayed into an account takeover — with a 1-hour
expiry and a `usedAt` marker rather than deleting the row on use (unlike the Reservation bug
elsewhere in this file, there's no unique constraint here a leftover used row could ever
block, since a fresh request always generates a fresh random token/hash). Requesting a new
reset link deletes any other outstanding *unused* tokens for that user first, so only the most
recently requested link is ever live — old used ones are left alone as a paper trail.
**`/reset-password` checks the token server-side before rendering (added in PR #43)**, not just
on submit — the page is an async Server Component that calls the read-only
`isPasswordResetTokenValid` (checks unused + not expired, doesn't mark it used) and shows the
same "Link invalid — request a new one" panel used for a missing token if it fails, matching
PR #28's dead-link convention. Only once the token checks out does it render the interactive
`ResetPasswordForm` client component (`src/components/reset-password-form.tsx`), which still
goes through `consumePasswordResetToken`'s atomic check-and-mark-used on the real submit — the
server-side page check is a fail-fast UX layer on top of that, not a replacement for it, since
the token could in principle go stale between page load and submit.
`/api/auth/forgot-password` always returns the identical generic response whether or not the
email/username matched an account, to avoid account enumeration.
**Every transactional email is hand-written table-based, inline-styled HTML** in
`src/lib/emails/`, not the app's normal Tailwind/CSS-variable styling and not Brevo's own
drag-and-drop template builder — email clients don't reliably support external stylesheets,
CSS custom properties, flexbox/grid, or inline SVG. `src/lib/emails/shared.ts`'s header (logo)
and footer (matching the real site footer's "Privacy" link and "© {year} Jack Baum" copyright,
not a separate wording) are a shared layout every future transactional email should render
through — Jack was explicit this must stay visually consistent across email types, not be
re-derived per template. **The logo went through two design iterations, not just sizing**:
originally a div/table-built lockup (bars + a separate wordmark `<div>`, two "still too small"
rounds against a mockup at https://claude.ai/artifact/WFB3B9RWc4e6iZiLyYKVwa before Jack signed
off on the size) — that rendered wrong in real Gmail (bars centered above the wordmark, wrong
font; email clients just don't apply this kind of CSS consistently), so PR #44 replaced it with
a plain `<img>` pointing at `public/logo-full-light.png`, the same flattened PNG asset the site
header/footer/Wordmark now all use via `FullLogo` (see "Full logo asset" above) — a real image
has no div/table layout to get wrong. No email dark-mode support (light theme only) — a
deliberate scope cut, since `prefers-color-scheme` support in email clients is inconsistent and
most strip `<style>` blocks anyway; revisit only if Jack asks. (This is also why the email
always uses the light-background PNG variant, never the dark one.)

**Confirmed email changes (`EmailChangeRequest`) — key decisions if you touch this again:**
`PATCH /api/account/email` no longer writes `User.email` directly — it only ever issues a
verification token; the actual column update happens when that link is clicked
(`consumeEmailChangeToken` in `src/lib/email-change.ts`). `EmailChangeRequest.userId` is unique,
so only one change is ever in flight per user, and — same delete-not-flag pattern as
`LibraryInvite`/reservation release (see "Bugs found and fixed") — the row's mere existence *is*
"pending"; confirming or cancelling both delete it outright. Only a SHA-256 hash of the token is
ever stored (same reasoning as `PasswordResetToken`), with a 1-hour expiry, and **a resend
rotates the token rather than reusing it** (unlike `LibraryInvite`, which does reuse its raw
token) — deliberately more paranoid here since this token can change what address controls the
account. Two emails go out, to different audiences and with different content: "Verify your
email" to the *new* address (`src/lib/emails/email-change-verify.ts`) is worded as "you" and
names the account's username, on the assumption the requester owns that inbox and wants to sign
in with it — it shows no other email addresses, since this inbox may belong to someone who's
never used Stacks; "Email change requested" to the *old*/current address
(`email-change-notice.ts`) is the one email of the pair that names an address (the new one, so
the owner knows exactly what's being changed to), carries no link of its own since that inbox
isn't the one being verified, and exists purely as a heads-up plus an escape hatch if the
request wasn't legitimate. **Resend vs. a genuinely new request are different code paths in the
same `PATCH` handler**: re-submitting the *same* address that's already pending is treated as a
resend (60s cooldown, same pattern as `LibraryInvite` resend, and does **not** re-send the
notice to the old address) while submitting a *different* address bypasses the cooldown
entirely and re-sends both emails — Jack's explicit call: a real change-of-mind shouldn't be
throttled by a cooldown meant to stop spamming one already-pending link. The dedicated
`POST /api/account/email/resend` route (used by the Profile page's plain "Resend link" button)
needs no password, since it doesn't change what's pending, only re-delivers it — `PATCH` itself
still requires `currentPassword` via the existing re-auth flow, for both a first request and a
Change-while-pending resubmission. `isValidEmailShape` (`src/lib/account-validation.ts`) was
fixed in the same PR to reject a second "@" — the original rule checked for a letter before/
after the following "." but never actually verified there was only one "@", so something like
`a@b@c.com` passed everywhere it was used (sign-up, profile, and this new field all share the
one function, so all three were fixed at once). `/confirm-email` (new top-level page, not under
`/dashboard`) does the actual consuming on a plain page load — unlike password reset, there's no
form step here, since clicking the emailed link *is* the confirming action; a missing, expired,
or already-used token shows the same "Link no longer valid" wording used elsewhere. Mocked up
first as an Artifact over several rounds before any code was touched: iterations covered
dropping a redundant "confirm new email" field, splitting one email into two with per-audience
wording, matching cooldown behavior to whether the address is actually changing, and swapping a
hand-drawn logo approximation for the real `FullLogo` PNG asset and `renderEmailLayout` shared
header/footer. Verified with a live local Playwright run covering both the profile-page
interaction (validation, duplicate-email 409, resend cooldown, change-while-pending, cancel) and
the real confirm-link round trip (token consumed atomically, a second visit to the same link
shows "no longer valid", sign-in works with the new email and stops working with the old one).

**ISBN lookup diagnostic log (`BookLookupLog`) — key decisions if you touch this again:** came
from Jack noticing real scans failing to find book details and wanting to see why, in a
project-thread session. His first idea was a plain text log file; declined because Stacks runs
on Vercel, where each function invocation gets its own ephemeral filesystem wiped on every
redeploy and never shared across concurrent instances -- a file would constantly lose data.
Logs to Postgres instead: one `BookLookupLog` row per lookup attempt (ISBN, library, what
triggered it, whether each of Google Books/Open Library was called and that call's outcome plus
real detail -- an HTTP status or exception message -- and whether the attempt resolved a title).
`src/lib/books.ts`'s `lookupBookByIsbn` returns these diagnostics alongside its existing result;
the three call sites that ever invoke it (scan-in's new-ISBN path, scan-in's manual-unresolved
retry path, and the edit page's manual "Look up this ISBN" button) each persist a row via
`src/lib/book-lookup-log.ts`. CSV import never calls either API, so it never logs.
**Deliberately no in-app viewer** -- Jack has direct Neon access and asked to just query the
table himself rather than have a viewer page built and maintained.

## Working agreements (how the user wants sessions to run)

These were established explicitly mid-project and apply to all future work,
not just the PR they were stated in:

1. **Branch + PR for everything, always.** *"Moving forwards, I would like all
   updates made in branches you create with PRs when I am ready so I can merge
   them for deployment."* Never push directly to `main`. Create a feature branch,
   commit there, push, open a PR against `main` via the GitHub MCP tools, and stop
   — the user merges when ready (they've been merging promptly in practice, but
   don't assume that or merge/close things yourself). Check `git log` on `main` at
   the start of a session; PRs get merged between sessions and you should build on
   top of the current `main`, not a stale local branch.
2. **Mockup first for any non-trivial UI/UX change**, before touching the real
   app. Build a standalone interactive HTML/CSS/JS artifact (via the `Artifact`
   tool and the `artifact-design` skill) — or, for a full branding/identity
   pass, a multi-artboard Claude Design canvas (the `design` skill) is the
   better tool, as used for PR #4 — iterate with the user through several
   rounds of feedback, and only start real implementation once they approve
   it. The mockup becomes the functional/UX spec — port its interaction logic
   faithfully rather than re-deriving it. Examples: the list/grid Library view
   (PR #2, several rounds — full-page detail view not a modal, per-row
   reserve/delete icons, Gmail-inbox-style bulk selection bar, grid view with a
   hover checkbox and a Google-Drive-style right-click context menu, "edit
   reservation" instead of "unreserve"); the "Ex Libris" branding (PR #4, a
   Claude Design canvas showing several directions applied to real screens);
   the cover-preview/copy-to-clipboard features (PR #7, an Artifact, two
   rounds — layout and toast-vs-inline feedback style both changed before any
   code was written).
3. **Record out-of-scope ideas instead of building them.** When something useful
   comes up mid-conversation but isn't what was asked for, add it to `IDEAS.md`
   rather than expanding the current task. Currently recorded: a "People" tab to
   pick reservees from instead of free-text (with the ability to add a new person
   from the reservation form), a light/dark/system theme setting on the Settings
   page, transactional email (Resend recommended if/when it's wanted), and CSV
   import/export (see "Scope notes" below for why that one came up).
4. **CHANGELOG.txt in a specific style**, matching the user's other app ("Freezr"). Was
   `CHANGELOG.md` through 5.0.0; renamed to `.txt` per explicit request — plain text, no
   markdown rendering assumed.
   Title `STACKS CHANGELOG`, a one-line versioning key
   (`x.0.0 = major | 1.x.0 = minor | 1.0.x = patch`), then reverse-chronological
   entries as `X.Y.Z -- YYYY-MM-DD` with a dashed underline, and bullets that
   explain changes with real technical detail — what changed, *why*, and root
   causes for fixes, not just "fixed a bug." Bump `package.json`'s `version` to
   match on every entry. Update this on every feature PR; don't let it drift.
5. **Test thoroughly before pushing, every time**: `npx tsc --noEmit` → `npx
   eslint .` → `npx next build` → a real local Playwright run that actually
   exercises the feature (clicks, fills forms, asserts on rendered content) —
   not just "it should work." Only then commit, push, and open the PR. If
   something needs verifying against the deployed production app specifically,
   do it with real checks (not fabricated ones) and clean up any test data
   created during that verification in the same session (e.g. via a narrowly
   scoped temporary admin route that's created, used once, and deleted before
   the session ends — never left in the codebase).
6. **Investigate root causes, don't paper over symptoms.** E.g. the searchParams
   staleness bug and the ISBN-lookup production timeout (below) were both root-
   caused via live testing rather than guessed at and patched blindly.

## Local dev environment notes (this sandbox)

- Local Postgres: `pg_ctlcluster 16 main start` (cluster already exists at
  `/var/lib/postgresql/16/main`). The `stacks` role/db and `.env` itself are
  **not** guaranteed to persist across sandbox containers — a fresh container
  may have neither. If `.env` is missing, create one matching `.env.example`
  with `postgresql://stacks:stacks@localhost:5432/stacks` for both
  `DATABASE_URL`/`DIRECT_URL`; if the role/db don't exist yet:
  `sudo -u postgres psql -c "CREATE ROLE stacks WITH LOGIN PASSWORD 'stacks';"`
  then `sudo -u postgres psql -c "CREATE DATABASE stacks OWNER stacks;"`. Run
  `npx prisma migrate deploy` after, before `npm run dev`.
- **Creating a new migration** (`prisma migrate dev`) needs a shadow database,
  which needs `CREATEDB` on the role: if you hit `P3014: permission denied to
  create database`, run
  `sudo -u postgres psql -c "ALTER ROLE stacks CREATEDB;"` first.
- **Prisma refuses destructive commands from an AI agent outright** (`migrate
  reset`, etc.) — it detects the agent invocation and errors asking for
  explicit user consent before it'll run, even with `--force`. Ask the user,
  then re-run with `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` set to their
  exact consenting message text (no newlines/quotes). Never work around this
  guard (e.g. by hand-editing the `_prisma_migrations` table) instead of
  asking. If you generate a migration you want to squash/redo before it's ever
  merged (still local-only, nothing shipped), this is the command you need —
  see PR #6 for a worked example (two migrations squashed into one with the
  user's consent, since both were part of the same still-unmerged feature).
- Playwright/Chromium: not in this project's `node_modules` — use the globally
  installed copy: `require('/opt/node22/lib/node_modules/playwright')`, with
  `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'` (the
  exact versioned path — there's no unversioned symlink). Launch with
  `args: ['--no-sandbox']`.
- The sandbox's egress proxy blocks some hosts and doesn't support HTTP2, so
  Chromium/Playwright generally can't reach a live production URL through it —
  production verification of anything needing a real browser falls back to
  `curl`-based API checks instead of full Playwright runs. Direct Postgres and
  most API hosts (Google Books, Open Library, Neon) do work once the
  environment's network policy is set to "full."
- `.env` in a fresh session container only has local dev values — production
  credentials (Neon, etc.) are not present and shouldn't be assumed available.

## Bugs found and fixed (context for anyone touching this code again)

- **Reservation release didn't actually release (fixed in PR #2).** `PATCH
  /api/reservations/[id]` with `release: true` used to only set `releasedAt` on
  the `Reservation` row rather than deleting it. Because `Reservation.copyId` is
  unique, that row stayed attached to the copy forever, which (a) made the UI
  keep showing the old reservee even after "releasing," and (b) made any future
  `POST /api/reservations` for that same copy fail permanently with a unique-
  constraint violation. Fixed by deleting the row on release instead. **Any
  production data from before this fix may still have copies stuck in this
  state** (reserved once, released, now silently unreservable) — this needs a
  one-time manual cleanup against the production DB, which no session has done
  yet (no prod credentials available from the sandbox). Worth checking dad's
  actual library for any book that's been through a reserve→release cycle.
- **Next.js 16 `searchParams` staleness** (register page) — see "Tech stack"
  above. Fixed by switching to `use(props.searchParams)`.
- **`LibrarySwitcher` stuck in "creating" state** after successfully creating a
  library — `router.refresh()` doesn't remount client components in the same
  layout, so local `creating` state survived. Fixed by explicitly resetting it
  in the success path instead of relying on the remount.
- **Client-fetched pages don't benefit from `router.refresh()`.** The Library
  page fetches its own data via `useEffect` + `fetch`, not server-rendered props,
  so `router.refresh()` after a mutation does nothing there. Components used on
  that page take an `onUpdated?: () => void` (or similar `onDone`) callback wired
  to the page's own refetch — remember this pattern if adding another
  client-fetched page.
- **ISBN lookup timing out in production only.** A book with an unusually large
  Open Library record (~30KB, full table of contents) reliably failed on Vercel
  but worked locally — root-caused to a 5s per-request timeout being too tight
  over Vercel's network path specifically. Fixed by widening the per-call
  timeout to 10s and the route's `maxDuration` to 45s, and adding real
  `console.error` logging (errors were previously swallowed silently).
- **Open Library lookups aborting with `AbortError: This operation was aborted`
  in real-world use (fixed in PR #55, 2026-09-19)**, surfaced once the new
  `BookLookupLog` (PR #53) gave Jack visibility into failures. Diagnosed with
  Jack in a project thread: first ruled out Open Library rate-limiting (their
  Covers API caps at 100 req/5min per IP, and wants a real contact email in the
  User-Agent, which is what `OPEN_LIBRARY_CONTACT` is for) — the exact error
  text confirmed it was our own client-side `AbortSignal.timeout(10000)`
  firing, not anything Open Library sent back. Root cause: `lookupOpenLibrary`
  ran its two *optional* enrichment calls — resolving an author-key reference
  to a name, and fetching a work's description when the edition record has
  none — sequentially, one `await` after the other. Combined with the
  always-required ISBN lookup and Google Books' own call ahead of it, a
  worst-case lookup (Google Books thin on data, needing both Open Library
  extras) chained up to four sequential 10s-capped fetches against the route's
  45s `maxDuration` — very little margin, so one slow response could blow the
  whole request past budget before later calls even started. Since the two
  optional calls don't depend on each other's results, they now run
  concurrently via `Promise.all` instead, dropping the worst case to
  effectively three calls and freeing real headroom under the 45s budget —
  same data fetched, same fallback behavior. This was compounded at the time
  by Jack's Google Books calls returning `HTTP 429` from the daily anonymous
  quota (see "ISBN lookup diagnostic log" below) — every lookup was falling
  through to the Open Library worst case until he set up a real Google Cloud
  project/key. **General lesson**: when chaining several timeout-capped
  network calls inside one `maxDuration` budget, check whether any of them are
  actually independent before assuming they must run in series — sequential
  `await`s "just because that's how the code reads" quietly eats the budget
  meant for the whole request.
- **Failed ISBN lookups were cached forever** as `source: "manual-unresolved"`
  books, with no retry. Fixed: scan-in now retries the lookup if the existing
  book row has that source.
- **"Last backup taken by..." didn't update until a manual page refresh (fixed
  in PR #13).** The download button triggered the export via a plain `<a>`
  click, which is fire-and-forget — there's no way to know when that request
  actually finishes — so it just guessed an 800ms delay before calling
  `router.refresh()`. Under real conditions the refresh could fire before the
  server's `Library.lastBackupAt`/`lastBackupByUserId` write had actually
  landed, so the page re-rendered with the still-stale data. **General
  lesson**: never pair a fire-and-forget action (an `<a>` click, `window.open`,
  etc.) with a guessed `setTimeout` to know when its server-side effect has
  landed — `fetch` it directly instead so there's a real promise to await, then
  act once it resolves. Fixed here by fetching the export and reading the new
  date/name back from response headers the route now sets, updating the
  displayed text from that directly instead of waiting on `router.refresh()`'s
  timing at all.
- **Adding padding to a fixed-width table cell can silently steal space from a
  sibling column, and it took three PRs (#21, #23, #25) on the Library list
  view's View Only row spacing to land on the right fix.** The list table has
  no `table-layout: fixed`, so column widths are just auto-layout hints — a
  `w-11` (44px) cell with `pl-4` (16px) padding added on top needs 50px+ of
  content width, and since the table is `w-full`, the browser takes that extra
  width from the nearest flexible sibling column (the title cell here) rather
  than growing the whole table. First attempt (#21) added `pl-4` straight to
  the cover cell without changing its width hint — content area lost, and the
  gap that used to exist *after* the cover (before the title) shrank to zero,
  reading as "smushed" from a new angle. Second attempt (#23) sidestepped this
  by always reserving the whole bulk-select checkbox column's width, leaving
  it visually empty for View Only — no column resized, but now there was a
  much bigger gap before the cover (58px) than after it (10px), reading as
  lopsided. The actual fix (#25): keep the checkbox column conditional as
  originally, but when adding `pl-4` to a cell that also has a fixed width
  hint, **widen that hint by exactly the padding amount** (`w-11` → `w-[60px]`
  for 16px of added `pl-4`) so the post-padding content area is unchanged and
  the browser has no reason to shrink anything else. **General lesson**: on
  any `w-full`, non-`table-layout: fixed` table, adding padding to a cell that
  also carries a `w-*` width class is never a no-op — either widen the class
  by the same amount, or the padding comes out of a sibling column's space.

## Scope notes

- The richer list/grid/detail/bulk-action treatment (PR #2) is **only** on the
  Library page (`/dashboard/library`, renamed from `/dashboard/search` in a later session to
  match its tab name — see PR history). The Shelf detail page intentionally still
  uses the older, simpler `CopyRow` component — that wasn't part of what was
  mocked up or asked for. Don't assume it should be unified across pages
  without checking with the user first. (The standalone Reservations page this
  note originally also listed was removed in PR #42 — see "Reservations folded
  into People" under "Data model".)
- A live Neon database connection string was pasted into chat once, early in the
  project. It was flagged once as a mild exposure risk; no rotation was
  confirmed. Worth a quiet check-in if credentials/security ever come up.
- **No production database access from this sandbox, by design — don't ask for
  it.** A fresh session's `.env` only ever has local dev values (see "Local dev
  environment notes"); there's no Vercel/Neon URL documented anywhere in this
  repo either. When the user asked for a seeded test library (~50 books, 5
  shelves, some reserved) to click around on the real deployed app, the answer
  wasn't to request prod credentials again — it was to record CSV import/export
  as a future feature (`IDEAS.md`) so test data (or any bulk data) can go in
  through a real, user-triggered feature instead of Claude touching the
  database directly. That's the intended pattern for this kind of request going
  forward, not a one-off. CSV import now exists (PR #12) — a future version of
  this same request should go through Settings → Import, not around it.
- **Follow-through on the above**: the user asked for a 30-row test CSV to
  manually QA the import feature in a real test library before go-live — one
  of every case the import logic branches on (two books with 2 physical
  copies each; the same person reserved to multiple different books, and
  different people each reserved to one; full/partial/no book-content fields;
  missing and malformed ISBNs). Generated and delivered directly to the user
  as a file (not committed to the repo — a one-off testing aid, not fixture
  code), and cross-checked against the app's real `parseCsv`/`isValidIsbn`
  logic before sending so the counts it'd produce were verified, not guessed.
  **The user's explicit plan: once manual testing is done, wipe all data
  before go-live** — don't treat test-data buildup (in the shared `Book`
  table especially) as something to clean up proactively in the meantime,
  that's expected for this phase. If a future session is asked to actually
  run that wipe, it's a previously-agreed, deliberate action, not a surprise
  request — but it's still a real destructive operation against whatever
  database is live at the time, so confirm scope (which environment, which
  librar(ies)) before running anything, same as any other destructive-action
  case.

## PR history

- **PR #1** (`claude/ideas-backlog`, merged) — `IDEAS.md` backlog file.
- Settings page, member removal, library deletion, no-library onboarding state —
  merged to `main` directly before the branch+PR workflow was adopted.
- **PR #2** (`claude/library-list-grid-view`, merged) — list/grid Library view,
  book detail page, unified reservation-edit modal, bulk actions, the
  reservation-release bug fix above. Full mockup-first process as described
  under "Working agreements."
- **PR #3** (`claude/project-history-doc`, merged) — created this file.
- **PR #4** (`claude/brave-shannon-frydwl`, merged) — the "Ex Libris" visual
  redesign (see "Tech stack" above): logo/favicon, full color + type system,
  every page/component restyled, no behavioral changes. Design was pitched via
  a Claude Design canvas handoff (not a from-scratch Artifact mockup) — the
  user picked direction `2a` after seeing several branding options applied to
  real screens. One follow-up commit on the same PR fixed review feedback
  (identity lockup size, favicon background color, list-view checkbox padding,
  a mis-sized grid-view selection chip).
- **PR #5** (`claude/brave-shannon-frydwl`, merged) — renamed `CHANGELOG.md` →
  `.txt` per explicit request; recorded transactional email as an idea.
- **PR #6** (`claude/brave-shannon-frydwl`, merged) — added BookCrossing ID,
  editable book details (`/dashboard/copies/[id]/edit`), and BCID search. A
  follow-up commit on the same PR fixed a real design flaw caught before
  merge: the first cut wrote user edits straight to the shared `Book` row,
  which would have let one library's bad edit corrupt what every other,
  unrelated library sees (see "Data model" above for the `BookOverride` fix).
  Verified with a Playwright test simulating two unrelated libraries sharing
  an ISBN. Also squashed two local migrations into one before merge (see
  "Local dev environment notes").
- **PR #7** (`claude/brave-shannon-frydwl`, merged) — cover-image preview on
  the edit form (refresh-on-demand, not per-keystroke) and a copy-to-clipboard
  icon for ISBN/BCID on the book detail page. Mockup-first via an Artifact,
  two rounds of feedback (preview layout moved to the right of the URL field
  with the caption text dropped; toast notification considered and dropped in
  favor of the inline checkmark/"Copied" style, matching the existing
  invite-link "Copy" button pattern). BCID format validation was proposed
  and explicitly declined — the real-world format needs confirming first,
  don't add it without asking.
- **PR #8** (`claude/brave-shannon-frydwl`, merged) — recorded CSV import/export as
  an idea (see "Scope notes" above for why).
- **PR #9** (`claude/brave-shannon-frydwl`, merged) — fixed the invite flow losing
  its invite code when someone clicked "Sign in" by mistake on an invite page and
  then switched to "Sign up": the register link had no `?invite=` param carried
  through from `next`. Root-caused via the Next 16 `use(props.searchParams)`
  pattern (not `window.location.search`) on the login page.
- **PR #10** (`claude/serene-goldberg-nd42ye`, merged) — recorded three ideas:
  "wipe library" as a less-destructive alternative to deleting it, a profile
  screen for own-account management, and a friendlier error for a dead invite
  link. No code changes.
- **PR #11** (`claude/serene-goldberg-nd42ye`, merged) — recorded the animated
  loading-screen idea (CSV import's first real use case) for slow operations.
- **PR #12** (`claude/csv-backup-import`, merged) — built CSV backup/import (see the
  "CSV backup/import" note under "Data model" above for the real design
  decisions) and the manual "Look up this ISBN" button on the book-edit page.
  Mockup-first over many rounds as an interactive Artifact — the whole
  Copy-ID-matching, dry-run-confirm-screen, and never-look-up-during-import
  design was worked out there, in conversation, before any code was written;
  the mockup evolved live as each new rule came up (non-CSV file rejection,
  duplicate column mapping, Copy ID as the match key, split missing/invalid
  ISBN skip counts, the manual-lookup attempt cap, the BookOverride-delete-on
  -resolve decision, the import-template link) rather than being built once
  and left alone. Verified with a Playwright run covering: empty-library
  export/template (headers only), a full import with all three skip/match
  outcomes, a Copy-ID-matched re-import proving idempotency (no duplicate
  copy), and the manual-lookup button's real success and failure paths.
- **PR #13** (`claude/import-loading-animation`, merged) — added the animated Mark
  loader to the import confirm modal's in-progress state (`src/components/
  mark-loader.tsx`, keyframes in `globals.css`) and fixed the "Last backup
  taken by..." staleness bug (see "Bugs found and fixed" above). Design was a
  Claude Design canvas (not a plain Artifact, since it's an animated brand
  asset — see the now-removed `IDEAS.md` entry this closed out): two motion
  directions were drafted and placed side by side, plus a third artboard
  showing the winner inside a mockup of the real modal chrome; the user picked
  the bars-dropping-in direction after seeing it animate live in that third
  artboard. One report mid-review ("direction A isn't moving") turned out to
  be the canvas editor not animating an unfocused/zoomed-out artboard, not a
  real bug — confirmed by isolating the same CSS in a plain browser and
  watching it run, before touching any code.
- **PR #14** (`claude/import-progress-tracking`, merged) — added a real progress bar,
  row counter, ticker, and live tally to the import confirm screen, which
  meant rearchitecting the import itself into small sequential batches rather
  than one request for the whole file (see the "CSV backup/import" note under
  "Data model" above for why, and the reveal-pacing mechanism that keeps it
  feeling continuous). Came out of the user asking a plain, good question
  before any of this was built — "does the import continue if I close the
  tab?" — which the batch-per-request design answers safely (only the
  in-flight batch is ever at risk) in a way the original single-big-request
  design couldn't have. Mocked up first as an Artifact, iterated three times
  (added the live tally/ticker: switched to batch-aware simulation with a
  toggle to reveal the batch seams once chunking was decided on: trimmed the
  "keep this tab open" copy down to one plain sentence) before any of the real
  code was touched. Verified with a live Playwright run against a real 30-row
  test CSV: confirmed progress genuinely advances mid-import (not an instant
  jump), the import was actually sent as multiple batched requests rather than
  one, and final counts matched. Caught and fixed a real (if minor)
  accessibility bug in the same pass: two adjacent counters/labels with no
  space in their rendered text (`Row X of Y` running straight into the `%`
  figure beside it, and the ticker's "Importing" label running into the title
  after it) — harmless visually since flex `gap`/margin provided the visual
  separation, but a screen reader would have read them concatenated.
- **PR #17** (`claude/project-thread-gq3u3r`, merged) — added the Owner/Admin/Member/View Only
  role system and per-role invite links (see the "Roles and invite links" note under
  "Data model" above for the full design). Built from a project-thread request, not a
  from-scratch mockup: the role rules and invite-link approach (four tiers, Member
  excluded from CSV import specifically, View Only fully read-only including no
  reservations, existing plain Members promoted to Admin) were worked out and explicitly
  agreed with the user in conversation before any code was touched, per the "get
  agreement before building" instruction for this kind of access-control change.
  Verified with a live local Playwright run: generated all three invite links and
  registered through each, confirmed API-level 403s for View Only (scan-in, reserve) and
  Member (import, shelf creation) with Admin succeeding at both, confirmed Settings
  section visibility per role, and confirmed the Owner-row protections server-side (409
  removing/demoting an Owner via the member endpoints; ownership transfer moves OWNER to
  the target and demotes the caller to ADMIN in one transaction).
- **PR #19** (`claude/library-notes`, open) — added a manila-notecard UI for
  `Copy.notes` (see "Data model" above) — inline on the book detail page, and via
  a corner tag + quick-read/edit popup on grid tiles and list rows in the Library
  page. Mocked up first as an Artifact over four rounds of feedback before any
  code was written: the grid tag originally navigated to the full book page
  (changed to a popup so browsing isn't interrupted); the list view's note
  affordance first lived in the row's actions cluster, which threw off
  reserve/remove icon alignment row-to-row once notes made the icon count
  inconsistent (moved to the cover corner instead, matching the grid tile, so
  every row's actions sit in the same two spots regardless of notes); the popup
  then gained inline editing and the same tape/folded-corner treatment as the
  on-page card, which had only supported reading at first. Verified with a live
  Playwright run: add/edit/delete on the book detail page (including a reload to
  confirm the server round-trip), edit from both the grid and list popups,
  confirmed a tag click never navigates away, and confirmed a copy without a
  note shows no tag. Reconciled with PR #17's concurrent role system after
  both merged: View Only members keep read access to notes but lose the
  add/edit/delete affordances, matching the server, which already rejected
  the underlying PATCH for anyone below Member.
- **PR #22** (`claude/wipe-library`, merged) — added "Wipe library" from the IDEAS.md backlog
  (see the "Wipe library" note under "Data model" above for the full design). Built from a
  project-thread request: recommendation and an interactive-Artifact mockup posted first, two
  rounds of feedback from Jack before any code was written (dropped the confirmation's "kept"
  column down to a 2x2 "removed" count grid; swapped the wipe-succeeded message off green onto
  the existing "Reserved" amber), then built once he said to proceed. Verified with a live
  local Playwright run: Owner sees both Wipe and Delete; an Admin (via a generated invite link)
  sees Wipe but not Delete and gets a 403 calling `DELETE /api/library` directly; Member and
  View Only see neither and get a 403 calling `POST /api/library/wipe` directly. Seeded a
  library with a shelf, two scanned-in copies, and a reservation, wiped it as the Admin, and
  confirmed via the API that shelves/copies/reservations were gone while both members and the
  invite code survived.
- **PR #21/#23/#25** (`claude/project-thread-b5ssfv`, `claude/list-row-spacing-fix`,
  `claude/list-row-spacing-balance`, all merged) — three iterations, from a project-thread bug
  report with a screenshot, to fix the Library list view's cover-thumbnail spacing for View
  Only members (who don't render the bulk-select checkbox column). See the "Bugs found and
  fixed" note above for the full root-cause arc and the general table-padding lesson it
  produced. Each round was driven by Jack pointing out exactly what still looked wrong from a
  real screenshot of the live change rather than a mockup — #21 shipped without a mockup (a
  small CSS tweak to an already-shipped, already-approved view, not a new UX direction), then
  needed two more real-screenshot-driven corrections once the actual rendered result didn't
  match intent. Verified at each step with Playwright: real DOM `getBoundingClientRect()`
  measurements of the checkbox/cover cell widths (not just eyeballing), comparing an Owner
  session against a View Only session on local Postgres.
- **PR #28** (`claude/project-thread-b65fhp`, merged) — closed the "Better error for a dead
  invite link" item from IDEAS.md. A dead invite link (regenerated code or deleted library)
  showed a generic, inconsistently-worded "not valid" message across four surfaces (`/join/
  [code]`, the register page's invite preview, the register API, the accept-invite API).
  Proposed a version first that logged *why* a link died (code rotated vs. library deleted,
  via a small audit table) so the message could name the specific reason, and shared that
  wording with Jack before building anything, per the "mockup/wording first" agreement — he
  preferred one simple message over the added schema, so it shipped as pure copy: "This link
  is no longer valid — contact the library owner to request a new one," made consistent
  across all four places. No schema change.
- **PR #29** (`claude/people-directory`, merged) — added the People directory (see the "People
  directory" note under "Data model" and the "Backup/import as a zip of two files" note under
  "CSV backup/import" above for the full design). Mockup-first over seven rounds as an
  interactive Artifact before any code was written — row/cross UI matched to the Library page,
  duplicate names allowed with email as the sole unique field, Location added as a fifth field,
  Member-level delete with reservation-count-aware confirmation wording, and the whole
  import/export rework (one zip of two files; either file also importable alone; Person-ID-only
  matching for a standalone `people.csv`; a `books.csv` row's blank Person ID falling back to a
  name match; two-or-more name matches always creating a new Person) all worked out and revised
  in conversation before Jack said "Good - build". Verified with a live local Playwright run:
  adding a person from the People tab, duplicate names allowed but a clashing email rejected,
  column sort toggling, search by email substring, the reservation combobox's inline
  person-creation path, both delete-confirmation wordings (with vs. without an active
  reservation), a full zip backup containing both files with a zero-reservation person present
  in `people.csv`, re-importing that same zip idempotently (people phase then books phase, zero
  new rows), and a standalone `people.csv`-only import correctly hiding the Books section.
- **PR #30** (`claude/profile-usernames`, open) — added the Profile screen and usernames (see
  the "Usernames and profile" note under "Data model" above for the full design). Built from a
  project-thread request, mockup-first over five rounds of an interactive Artifact before any
  code was touched: the header dropdown, the inline-panel-vs-popup "Change" comparison (Jack
  picked inline), the re-auth-before-save flow, the live password checklist, and the email-shape
  rule were all worked out in the mockup as Jack's feedback came in, including catching and
  fixing a real design flaw before it was ever built — an early round asked to let users "reveal"
  their current password, which isn't possible once it's only ever stored as a bcrypt hash; fixed
  by moving the reveal toggle onto the new-password fields instead of the static masked row.
  Account deletion (also in the original IDEAS.md entry) was explicitly deferred to a follow-up
  at Jack's call. Verified with a live local Playwright run covering: signup's disabled-until-valid
  submit button and password checklist; the header dropdown showing username (not name); a
  taken username blocked before the re-auth popup ever opens; a wrong current password rejected
  with the popup staying open, then clicking outside it to dismiss like Cancel; a correct
  password completing the username, email, and password changes in turn; and finally signing out
  and back in with the newly-changed username and password to prove the whole loop actually
  works end to end. Also confirmed signing in by email still works unchanged.
- **PR #31** (`claude/library-picker-restyle`) — restyled the dashboard header's library
  picker off a plain native `<select>` (whose open list is unstyled OS chrome no CSS can
  reach) onto the reservation picker's own menu language: `paper-shadow-sm`, our border/
  radius, `chip-hover` rows, a checkmark on the active library. "+ New library…" moved out
  of the option list into its own accent-colored row below a divider, same as how the
  reservation picker breaks "add a new person" out from its match list, and still opens the
  same inline create-library form as before (unchanged). Built as a `role="combobox"`
  trigger button that keeps focus throughout via `aria-activedescendant` instead of moving
  focus into the popup — this is what made keyboard support work identically regardless of
  whether the menu was opened by mouse or keyboard (arrows/Home/End/Enter/Escape/typeahead,
  with "+ New library…" reachable via End+Enter since it's part of the same navigable
  sequence); an earlier draft attached the keydown handler to the listbox itself, which
  silently broke Escape and arrow-key navigation whenever the menu was opened by a mouse
  click (focus never left the trigger button), caught by a live Playwright run rather than
  by inspection. Mocked up first as an Artifact, approved without changes ("new one is
  good").
- **PR #32** (`claude/username-required`, merged) — follow-up to PR #30: made `User.username`
  required now that Jack set a username on both real accounts from the new Profile page.
  `prisma/schema.prisma` changed `username String? @unique` to `username String @unique`, with
  a one-line `ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL` migration (safe to run
  since no row had a null username by the time this shipped). Removed the now-dead null-handling
  this required while PR #30 was still in its transition period: `ProfileMenu`'s `username ?? email`
  fallback (and its now-unused `email` prop), `ProfileForm`'s `initialUsername: string | null`
  and its `?? ""` default, and the `username ?? "Not set"` display row. No user-facing behavior
  change beyond the DB constraint itself, since every real account already had a username by the
  time this merged. Verified by re-running PR #30's full Playwright regression (23 checks) against
  the migrated schema.
- **PR #33** (`claude/project-thread-vc3oh3`, merged) — added a page-size picker and
  pagination to the Library list (see the "Library list pagination" note under "Data
  model" above for the full design). Built from a project-thread request; mocked up first
  as an interactive Artifact, one round of feedback (Jack asked to drop the "Show" label
  next to the page-size numbers) before any code was touched. Verified with a live local
  Playwright run against a seeded 430-copy test library: default page size 25 with the
  correct page count; switching to 200 shows 200 rows; clicking Next shows the next 200
  while the page-size picker still reads 200 (the specific bug Jack reported — paging
  used to have no defined behavior since pagination didn't exist yet); List ↔ Grid
  preserves the current page; searching resets to page 1 and the pager disappears once
  results fit on one page; a same-browser reload keeps the chosen page size but resets to
  page 1. Test data cleaned up from the local DB afterward.
- **PR #34** (`claude/project-thread-a8yr7j`, open) — added a full-screen loading takeover
  for switching, creating, and deleting a library (see the CHANGELOG's 6.11.0 entry for the
  full design). Built from a project-thread request; mocked up first as an interactive
  Artifact before any code was touched, iterated live in chat with Jack picking each of the
  three captions from short lists (switch: "Dusting off the shelves", create: "Unlocking the
  reading room", delete: "Returning every book") before approving. `LibraryLoadingOverlay`
  reuses import's `MarkLoader` + dimmed-card chrome but has no progress bar, since these are
  each a single request with nothing real to meter. Uses React 19's async `useTransition`
  (not a local busy flag or a guessed timeout) so the overlay's visibility is tied to the
  transition's real `isPending` state and only clears once `router.refresh()`'s new data has
  actually landed — the same class of bug as the earlier `LibrarySwitcher` "stuck creating"
  and "Last backup taken by..." staleness bugs, avoided this time by construction rather than
  patched after the fact. Verified with a live local Playwright run: registered a fresh
  account, created a second library and confirmed the create overlay's message/caption
  appear and clear on navigation, switched back to the first library and confirmed the same
  for switch, then deleted the second library from Settings and confirmed the same for
  delete (11/11 checks passed).
- **PR #35** (`claude/site-footer`, open) -- added a global site footer (see the "Site
  footer" note under "Tech stack" above) and a `/privacy` placeholder page. Came from a
  project-thread ask that grew mid-conversation: started as "just add a footer," Claude proposed
  a minimal version-number-only treatment and mocked it up, then Jack said he actually wants to
  roll Stacks out beyond his own household to his dad's wider international book-sharing network
  and asked for the full treatment -- logo, version, copyright, and a privacy notice link, with
  help writing the notice itself since Stacks isn't a registered company. A full privacy notice
  was drafted and checked against the real code (the People directory's third-party data, the two
  functional cookies, no analytics/tracking/ads/selling) and shared as a mockup, but Jack asked to
  ship just a "coming soon" placeholder at `/privacy` for now and track writing the real one as an
  idea -- see IDEAS.md's "Write the real privacy notice" entry for the draft's status and the
  personal-use-exemption caveat. Copyright line reads "(c) {year} Jack Baum" (his full name, not
  "Stacks" -- an unregistered, non-legal-entity name can't itself hold copyright; ownership sits
  with Jack as the individual who created the work, automatically and regardless of any company
  registration; he confirmed he wanted his full name over just "Jack" once asked).
- **PR #39** (`claude/password-reset-email`, open) — added password reset by email and Brevo
  as the transactional email provider (see the "Password reset & transactional email" note
  under "Data model" above for the full design). Built from a project-thread session that
  started with buying stacksonline.com on Cloudflare and setting up its DNS end to end (SPF,
  DKIM, DMARC, a branded `mail` subdomain, Google Postmaster Tools, a Gmail "send mail as"
  alias for `info@` routed through Brevo's SMTP relay) before any app code was touched, then
  moved to the password-reset feature once the domain/email groundwork was solid. Mocked up
  the email itself first as an Artifact, four rounds of feedback before any code was written
  (username shown in brackets for deliverability; an inline "request a new one" link on the
  expiry line; copyright/footer links added and reconciled against the real site footer's
  wording; the logo lockup sized up twice, "still too small" each time, before Jack signed
  off). Verified with a live local Playwright run: full round trip via the dev-console-logged
  reset link (no real Brevo key in this sandbox) from request through sign-in with the new
  password, old password rejected, a reused reset token rejected rather than silently
  accepted twice, and a nonexistent identifier still getting the same generic response as a
  real match (no account enumeration). Test user cleaned up from the local DB afterward.
- **PR #40** (`claude/scan-shelf-typeahead`, merged) — reworked the Scan station's Shelf field
  for barcode-driven scanning: moved it below the ISBN field (matching scan order) and
  replaced the plain `<select>` with `src/components/shelf-combobox.tsx`, a type-ahead
  combobox matching a shelf's name or code, modeled on `PersonCombobox` but resolving a
  match on Enter (not just on click) since a shelf barcode scan ends with Enter and no
  further click is possible. Chains the two Enters a barcode scanner sends: Enter after the
  ISBN moves focus to Shelf, Enter after the shelf code resolves the match and submits in the
  same keystroke; refocusing the Shelf field also selects its existing text so a new scan
  overwrites instead of appending. Renamed "Go" to "Scan in"/"Scan out" and moved it beside
  the Shelf field. Built from a project-thread request (Jack's dad assigns each shelf a code
  like A1/B2 and scans it after the ISBN); mocked up twice as an interactive Artifact before
  any code was touched (https://claude.ai/artifact/DHuEk1Mg9TfdtGWX5x3pAb — first the overall
  interaction, then a desktop-layout pass after Jack asked for the button beside the Shelf
  field instead of full-width below it). The camera icon's desktop visibility is deliberately
  untouched here — that's a separate mobile-scan-layout thread. Caught and fixed a real bug
  during Playwright verification: `ShelfCombobox`'s text-sync effect (copied from
  `PersonCombobox`) reset the field to empty on every keystroke once a shelf was pre-selected,
  because typing clears the parent's selection to `null` and the effect treated that as an
  external deselect. `PersonCombobox` never hits this since nothing pre-selects a person
  before typing, but the Scan page pre-selects the previous shelf as a convenience default —
  exactly the case that triggers it; fixed by only syncing text on a truthy selection. If
  `PersonCombobox` is ever given a similar pre-selected-default use case, check it for the
  same bug. Verified with a live local Playwright run (23/23 checks): the full chained-Enter
  sequence, matching by code and by name, the refocus-selects-existing-text behavior, manual
  click-to-select, an unmatched shelf on Enter showing an inline error without submitting,
  Remove mode's lone ISBN Enter still submitting directly, and both button labels rendering
  correctly per mode.
- **PR #41** (`claude/project-thread-pedcpo`, merged) — added the mobile navigation shell and
  phone-width card layouts (see the "Mobile navigation shell" note under "Tech stack" above for
  the full design). Built from a project-thread ask, kept deliberately separate from sibling
  threads doing the nav-tab reorder, the reservations/people redesign, and the scan page's
  shelf-field/barcode-keyboard rework (PR #40 above, merged first — rebased the camera-icon
  `sm:hidden` change onto its new Shelf-combobox/"Scan in" button layout rather than the old
  plain row). Diagnosed the header/nav overflow with real DOM measurements (`scrollWidth` vs
  `clientWidth`) rather than eyeballing it, then mocked up three distinct nav-shell options as
  an Artifact (https://claude.ai/artifact/8TiMjszXPNzXCAidmHuym5) — Jack picked the bottom tab
  bar and separately flagged the iOS home-indicator/Android gesture-bar collision risk before
  it was addressed, and confirmed the PWA-not-native-app direction. Once he asked to see every
  page, not just the nav shell, built a full 8-screen tappable prototype
  (https://claude.ai/artifact/BfWyBW8afzpUUqTXB4YTby) covering the nav plus redesigned
  Library/People/Reservations screens, approved as-is ("Yes good"). Verified with a live local
  Playwright run across iPhone-13 and 1440x900 viewports, 13 checks covering header overflow,
  bottom bar + More sheet navigation, the camera-icon desktop/mobile split, the Library
  table-vs-cards switch, Reservations having no horizontal overflow, and the profile name's
  visibility split — re-verified after rebasing onto PR #40's merged shelf-combobox rework. The
  bottom sheet's "Reservations" entry and the Reservations-specific verification were both made
  stale by PR #42 merging shortly after (see below) — reconciled there, not by editing this PR's
  own history entry.
- **PR #42** (`claude/project-thread-yqofnc`) -- folded Reservations into People and removed
  the standalone tab (see the "Reservations folded into People" note under "Data model" above
  for the full design). Came from a project-thread ask to rethink the Reservations page;
  mocked up first as an Artifact over two rounds -- round one proposed three directions with a
  recommendation for an age-sorted "ready to ship" queue, which Jack corrected: reservations
  exist purely to batch several books to the same person before mailing them together
  cost-effectively, not to track what's waited longest, so nothing about hold duration belongs
  in the design. Round two rebuilt it as "option 1 with elements of 2" per his direction, and a
  same-thread follow-up ("yeah I want it added here too") confirmed reassigning who a copy's
  reserved for (Edit) should live on this screen as well, not just on the Library page's
  existing reservation editor. Merged alongside PR #41's concurrently-built mobile nav shell:
  removed the "Reservations" row PR #41 had added to the bottom-sheet "More" menu and gave the
  People page's new phone-width card layout the same clickable "N active" badge the desktop
  table already had, so the Reserved overlay stays reachable on a phone now that no nav surface
  links to a standalone Reservations page.
- **PR #43** (`claude/reset-link-reuse-fix`, open) — fixed `/reset-password` so a link that had
  already been used or had expired reads as invalid on page load instead of only failing after
  the user fills in the form and submits (see the "Password reset & transactional email" note
  under "Data model" above for the mechanism). Came from a project-thread request right after
  PR #39 (password reset) merged. Verified with a live local Playwright run: a bogus token and a
  missing token both show "Link invalid" immediately with no form rendered, a fresh link shows
  the real form, and revisiting the same link after a successful reset shows "Link invalid" with
  a request-new-link button on load rather than the form. Test user cleaned up afterward.
- **PR #44** (`claude/project-thread-3t01nt`, open) — replaced the live SVG mark + text
  lockup with a single approved logo PNG everywhere it appears (see "Full logo asset" under
  "Tech stack" above for the full design). Two independently-reported bugs from separate
  project threads turned out to share one root cause: the footer icon-size bump (PR #36,
  merged the same day, three rounds: 16px -> 28px -> 36px) left the "Stacks" text next to it
  stuck at its old size, and the email template's div/table-built bars rendered wrong in real
  Gmail (bars centered above the wordmark, wrong font) — both were symptoms of the same
  icon+wordmark lockup being hand-recreated separately in five places with no way to guarantee
  they'd match. Fixed at the root by having Jack produce one flattened logo (light- and
  dark-background PNG variants) in Claude Design — Claude wrote him an exact prompt describing
  the current mark's bar coordinates/colors and the Newsreader wordmark spec so the recreation
  would match precisely — approving it before any code changed, then building `FullLogo`
  (`src/components/full-logo.tsx`) as the one component every call site (site header, dashboard
  header, footer, `Wordmark`, email template) now renders through, replacing PR #36's
  Mark-size-36-plus-13px-text footer markup entirely (that PR's own useful addition, linking the
  footer logo to `/dashboard`, was carried forward). Verified with a live local Playwright run:
  homepage and dashboard header/footer in both light and dark color schemes (confirming the
  `dark:` variant correctly swaps the PNG), the `Wordmark` component on the login page, and the
  real password-reset email HTML rendered end to end through `/api/auth/forgot-password` (a
  temporary debug line dumped the generated HTML for a screenshot, then was reverted; test
  accounts/library cleaned up from the local DB afterward). Rebased onto `main` after PR #36,
  #40, #41, and #43 all merged ahead of it the same day.
- **PR #45** (`claude/project-thread-yqofnc`) — two follow-ups Jack raised right after PR #42
  (the Reservations-into-People fold) shipped. First, the "Reserved" overlay's closing behavior:
  it used to call the People page's full `loadPeople()` on close, refetching and re-rendering
  every row even though releasing or reassigning a reservation only ever changes one or two
  people's counts. `ReservedOverlay` now snapshots per-person reservation counts on open, diffs
  them against its current state on close, and reports only the `{personId, count}` pairs that
  changed; `PeoplePage` patches just those rows' "N active" pill instead of reloading. Second,
  the subtitle text under "Reserved" — Jack asked for the postage/"whole point" framing removed
  entirely (not reworded) since it re-explained the feature's rationale every time the screen
  opened; picked "A running list of every active reservation, ready to edit or release" from
  three one-line options offered in the project thread. Verified with a live local Playwright
  run: releasing a reservation and closing the screen patches only that person's row with zero
  `GET /api/people` requests fired, an unrelated person's row stays untouched, and the existing
  18-check Reserved-screen regression suite still passes in full.
- **PR #50** (`claude/project-thread-yej69l`) — replaced the three per-role invite links with an
  emailed invite system (see the "Emailed library invites" note under "Data model" above for
  the full design). Built from a project-thread request with a detailed spec from Jack up
  front (email-first invites, a confirmation popup always shown after sign-in rather than
  instant joining, an Open Invitations tab with cancel/resend and a 60s cooldown); mocked up
  the email itself first as an Artifact before any code was touched, since it's the one
  new-to-users piece of UI — approved after two rounds of copy tweaks (dropped the "if you
  weren't expecting this" reassurance line entirely, and simplified the sign-in/sign-up line to
  "Sign in or create a Stacks account to accept the invitation."). Verified with a live local
  Playwright run (16/16 checks) covering the full loop for both a brand-new account and an
  existing one, plus cancel and dead-link behavior — see the CHANGELOG's 7.0.0 entry for the
  full list. Coordinated with two sibling threads working the same day: the members-table
  changes (Make Owner in the role dropdown, a Save button, branded Remove dialog) and the
  mandatory create-a-library popup after sign-up were both left alone — this PR only touches
  the Members section's invite half and the pre-existing zero-membership dashboard state.
- **PR #53** (`claude/project-thread-zusr4i`) — added the `BookLookupLog` diagnostic table for
  ISBN lookups (see the "ISBN lookup diagnostic log" note under "Data model" above for the full
  design). From a project-thread ask: Jack noticed real scans failing to find book details and
  proposed a text-file log; the proposal Claude sent back before writing any code recommended a
  Postgres table instead, since Vercel's per-invocation ephemeral filesystem would just lose a
  file's contents on every redeploy — Jack agreed, and separately said no in-app viewer was
  needed since he'd rather query Neon directly. Verified with a live local Playwright run
  (12/12 checks) against the real Google Books and Open Library APIs (not mocked) — see the
  CHANGELOG's 7.3.0 entry for the full list, including a genuine Google Books quota-exhaustion
  429 this sandbox hit during the run, logged exactly as the feature is meant to capture.
- **PR #55** (`claude/project-thread-cp2mpn`, merged) — fixed Open Library ISBN lookups
  aborting with client-side timeouts in real-world use, found via the new `BookLookupLog`
  from PR #53 (see the "Open Library lookups aborting" entry under "Bugs found and fixed"
  above for the full root cause and fix). From a project-thread session: Jack first thought
  it was a Google Books quota problem, which led to walking him through setting up a real
  Google Cloud project/key (operational, no code change) and confirming `OPEN_LIBRARY_CONTACT`
  for Open Library's API etiquette; once that was live the remaining errors' exact text
  (`AbortError: This operation was aborted`) pointed at our own timeout instead of either
  provider. Verified with a direct `lookupBookByIsbn` script against the real APIs (Google
  Books quota-exhausted in this sandbox, forcing full Open Library fallback on every ISBN,
  confirming both sub-calls still resolve correctly running in parallel) plus a live local
  Playwright run through the real Scan station confirming an end-to-end scan-in resolves
  title/author with no abort surfaced in the UI. Test account and library cleaned up from the
  local database afterward.

- **PR #57** (`claude/settings-refresh`) — four small settings/header changes bundled into one PR
  since they all touch the Settings page and parallel threads here reliably collide on it: the
  dashboard header logo matched to the footer's size (26px -> 36px, the zero-library header was
  already fixed in PR #54), the Shelves list made a collapsed-by-default disclosure with a
  name filter (Jack's dad has ~30 shelves), Backup & Import split into two tabs with the old
  single "Download backup" button replaced by three cards (Full backup / Library only / People
  only — see "Backup/import as a zip of two files" under "Data model" for the export machinery
  this reuses), and "Wipe library" renamed to "Empty library" with shelves no longer cleared by
  it (only books/reservations/book corrections). Mocked up first as an Artifact, several rounds
  of Jack's feedback per section before any code was touched — the Backup tab specifically was
  shown two layouts side by side (three cards vs. a single dropdown, since Jack said he was open
  to alternatives) and he picked cards, then asked to drop the per-card filename captions, move
  "Last taken by" into the Full backup card specifically, and put Backup before Import. The
  Empty-library rename also renamed the underlying identifiers to match (`/api/library/wipe` ->
  `/api/library/empty`, `WipeCounts`/`canWipe` -> `EmptyCounts`/`canEmpty` in
  `danger-zone-section.tsx`) rather than leaving old internal names under new UI text, and reuses
  `LibraryLoadingOverlay` with the exact same "Returning every book" hint Delete library already
  uses, per Jack's explicit ask for the same text rather than new copy. Verified with a live
  local Playwright run (29/29 checks): header/footer logo heights match exactly; the shelf list
  stays collapsed until toggled and its filter narrows/keeps the right rows; the Backup tab is
  selected by default with three cards and no filename text, Library-only and People-only
  downloads produce the correct single CSV each (checked actual file contents) without touching
  the backup-taken marker while a Full backup download does update it; "Empty library" (not
  "Wipe library") shows a Books/Active-reservations-only confirmation grid, the reused loading
  hint appears while it runs, and — the actual point of the change — shelves created before
  emptying are still there afterward. Test accounts/libraries cleaned up from the local database
  afterward.
- **PR #63** (`claude/library-code-urls`) — moved the whole dashboard from a cookie-selected
  "active library" to a real per-library URL (see "Library-code URL routing" under "Data model"
  above for the full design). Came from Jack asking what it would take to put a library code in
  the URL itself so multiple libraries could be open in different browser tabs at once; he
  explicitly told Claude to drop any backward-compatible-redirect plan for the old
  `/dashboard/...` links ("nothing is bookmarked") once that tradeoff was raised, and confirmed
  the approach with an example URL (`stacksonline.com/L-7K3M9Q/library`) before any code was
  written. Pure routing/plumbing with no new visual UI, so no mockup round was needed — a case
  the "mockup first for non-trivial UI/UX" agreement doesn't cover, since nothing about how any
  page *looks* changed. Every dashboard page moved from `/dashboard/...` to `/{code}/...` and
  every library-scoped API route moved from `/api/library/...`, `/api/copies/...`, etc. to
  `/api/{code}/...`; ~20 client components were threaded with a `code` prop so their fetches and
  navigation links target the right library regardless of what any other open tab is doing.
  Verified with a live local Playwright run (13/13 checks): two separate browser contexts each
  registered, created their own library, and scanned a different book onto a different shelf at
  the same time, confirming zero cross-contamination between the two concurrently-running tabs —
  the actual point of the feature — plus the "no access" message for a non-member's library code,
  the switcher UI, and the `/dashboard` lobby redirect. Test accounts/libraries/shelves/copies
  cleaned up from the local database afterward.
- **PR #64** (`claude/email-change-confirmation`) — added click-to-confirm email changes (see the
  "Confirmed email changes" note under "Data model" above for the full design). Built from a
  project-thread request; mocked up first as an interactive Artifact over four rounds of Jack's
  feedback before any code was touched — dropping a redundant confirm-email field, splitting the
  single notification into two emails with per-audience wording, dropping the resend cooldown for
  a genuine address change while keeping it for a same-address resubmission, and using the real
  `FullLogo` asset instead of a hand-drawn approximation. Also fixed a real, separately-reported
  bug in the same PR: `isValidEmailShape` never actually rejected a second "@", so sign-up,
  profile, and this new field all picked up the fix from the one shared function. Verified with a
  live local Playwright run covering the profile-page interaction (live validation, a 409 for an
  email already on another account, the resend cooldown, reopening Change while pending, cancel)
  and the real confirm-link round trip end to end (atomic single-use consumption, sign-in working
  with the new email and failing with the old one). Test accounts cleaned up from the local
  database afterward.

## Keeping this file current

Update this file when: a new working agreement is established, a non-obvious
framework/library gotcha is discovered, a real bug with a non-trivial root cause
is fixed, or a scope/architecture decision is made that a future session
shouldn't accidentally re-litigate or contradict. Keep entries factual and
specific (what happened, why it matters going forward) rather than a session-by-
session diary — prune detail that's no longer relevant once it's fully
superseded.
