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
- **Tailwind CSS v4**, dark mode via `dark:` variants driven by OS preference only
  — there is no in-app light/dark/system toggle yet (recorded as a future idea,
  see `IDEAS.md`).
- **Deployment**: Vercel + Postgres on Neon. `package.json`'s `build` script runs
  `prisma migrate deploy && next build`; `postinstall` runs `prisma generate`.

### Data model

Multi-tenant: `Library` ↔ `User` via `Membership` (role: OWNER/ADMIN/MEMBER).
`Book` is a **shared global catalog** keyed by `isbn13` (unique) — the same ISBN
scanned into two different libraries reuses one `Book` row; each library gets its
own `Copy` row pointing at it. `Copy` has a `status` (AVAILABLE/RESERVED/REMOVED)
and an optional `Reservation` (1:1 via `Reservation.copyId @unique`). Sharing a
library between people uses a random `Library.inviteCode` link, not email (no
transactional email provider is set up — see CHANGELOG 2.0.0).

**Important constraint to know about:** `Reservation.copyId` is `@unique`, so a
`Copy` can only ever have **one** `Reservation` row across its whole history
unless that row is deleted. This bit us once — see "Bugs found and fixed" below —
so if you're touching reservation code, releasing a reservation must delete the
row, not just flag it, or the copy becomes permanently unreservable.

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
   tool and the `artifact-design` skill), iterate on it with the user through
   several rounds of feedback, and only start real implementation once they say
   something like "happy with the mockup." The mockup becomes the functional/UX
   spec — port its interaction logic faithfully rather than re-deriving it. This
   was the process for the list/grid Library view (PR #2): several rounds of
   detailed mockup feedback (full-page detail view not a modal, per-row
   reserve/delete icons, Gmail-inbox-style bulk selection bar, grid view with a
   hover checkbox and a Google-Drive-style right-click context menu, "edit
   reservation" instead of "unreserve") before any production code was written.
3. **Record out-of-scope ideas instead of building them.** When something useful
   comes up mid-conversation but isn't what was asked for, add it to `IDEAS.md`
   rather than expanding the current task. Currently recorded: a "People" tab to
   pick reservees from instead of free-text (with the ability to add a new person
   from the reservation form), and a light/dark/system theme setting on the
   Settings page.
4. **CHANGELOG.md in a specific style**, matching the user's other app ("Freezr").
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
  `/var/lib/postgresql/16/main`; role `stacks` / db `stacks` already provisioned,
  matching `.env`'s `DATABASE_URL`). Run `npx prisma migrate deploy` after
  starting it, before `npm run dev`.
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

## Scope notes

- The richer list/grid/detail/bulk-action treatment (PR #2) is **only** on the
  Library page (`/dashboard/search`). The Shelf detail page and Reservations
  page intentionally still use the older, simpler `CopyRow` component — that
  wasn't part of what was mocked up or asked for. Don't assume it should be
  unified across pages without checking with the user first.
- A live Neon database connection string was pasted into chat once, early in the
  project. It was flagged once as a mild exposure risk; no rotation was
  confirmed. Worth a quiet check-in if credentials/security ever come up.

## PR history

- **PR #1** (`claude/ideas-backlog`, merged) — `IDEAS.md` backlog file.
- Settings page, member removal, library deletion, no-library onboarding state —
  merged to `main` directly before the branch+PR workflow was adopted.
- **PR #2** (`claude/library-list-grid-view`, merged) — list/grid Library view,
  book detail page, unified reservation-edit modal, bulk actions, the
  reservation-release bug fix above. Full mockup-first process as described
  under "Working agreements."

## Keeping this file current

Update this file when: a new working agreement is established, a non-obvious
framework/library gotcha is discovered, a real bug with a non-trivial root cause
is fixed, or a scope/architecture decision is made that a future session
shouldn't accidentally re-litigate or contradict. Keep entries factual and
specific (what happened, why it matters going forward) rather than a session-by-
session diary — prune detail that's no longer relevant once it's fully
superseded.
