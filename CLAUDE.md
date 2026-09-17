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
  No NextAuth. A separate "active library" cookie tracks which library is
  currently selected (a user can belong to more than one).
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
  `book-cover.tsx` is the only user) defaults to OS-preference-only in v4, so
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
  redefining the underline-input look inline. Logo mark + favicon are generated
  SVG/PNG (see `src/components/mark.tsx`, `src/app/icon.svg`), not hand-drawn.
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

`Copy.notes` (free text, 2000-char cap) is per physical copy, same reasoning as
`bookCrossingId` — two copies of the same ISBN can carry different notes. The field
and its `PATCH /api/copies/[id]` endpoint existed since the CSV import/export work
(PR #12) but sat unused in the UI until PR #19 gave it a manila-notecard UI
(`src/components/copy-notecard.tsx` on the book detail page,
`src/components/note-popup.tsx` for the quick-read/edit popup opened from the
corner tag on grid tiles and list rows in `/dashboard/search`). The manila color
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
- **Three invite links, not one** — `inviteCodeAdmin`/`inviteCodeMember`/`inviteCodeViewOnly`
  on `Library`, each independently generated/regenerated from Settings. There is deliberately
  no invite link for Owner; the only way anyone becomes Owner is the transfer-ownership
  endpoint. `src/lib/invite-code.ts`'s `findLibraryByInviteCode` checks all three columns and
  returns which role a given code grants — always go through it rather than querying a
  specific column, since a code's owning column can be any of the three.
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

## Scope notes

- The richer list/grid/detail/bulk-action treatment (PR #2) is **only** on the
  Library page (`/dashboard/search`). The Shelf detail page and Reservations
  page intentionally still use the older, simpler `CopyRow` component — that
  wasn't part of what was mocked up or asked for. Don't assume it should be
  unified across pages without checking with the user first.
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

## Keeping this file current

Update this file when: a new working agreement is established, a non-obvious
framework/library gotcha is discovered, a real bug with a non-trivial root cause
is fixed, or a scope/architecture decision is made that a future session
shouldn't accidentally re-litigate or contradict. Keep entries factual and
specific (what happened, why it matters going forward) rather than a session-by-
session diary — prune detail that's no longer relevant once it's fully
superseded.
