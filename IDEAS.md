# Ideas backlog

Things worth doing later, captured so they don't get lost. Not scheduled —
move an item into an actual task when it's time to build it.

## "Mark as sent" / what happens to a copy once it leaves the library

The Reserved screen (People tab, rework in the "Reservations, rethought" project
thread) only offers Release for now -- releasing just frees the copy back up as
AVAILABLE, same as it always has. An early mockup round also had a "Mark as
sent" action for a reserved copy that's actually been mailed out, but Jack
flagged that we haven't actually designed what that means yet: does the copy
get scanned/removed like it left the library entirely (same as today's manual
Remove), or does it need its own status distinct from REMOVED so a "sent
copies" history is browsable later? Left out of the rework and dropped back to
just Release until this gets its own design pass.

## "Export people" button on the People tab

The full backup zip now always includes `people.csv`, but there's no
lightweight way to export *just* the directory (no books, no zip) for
someone who only wants to bulk-edit contact details in a spreadsheet. Add a
one-click "Export people" button on the People tab itself that downloads a
bare `people.csv` -- same shape as the file inside the zip, just without the
books half or the zip wrapper. Raised as an open question during the People
directory build and left for later rather than assumed.

## Write the real privacy notice

The footer (added the same session this idea was recorded) links to `/privacy`, but
the page itself is just a "coming soon" placeholder for now — Jack wants to roll
Stacks out beyond his own household to his dad's wider book-sharing network, "around
the world," and asked for help writing a real one before that happens. A full draft
already exists (written and reviewed against the actual code — what's collected, the
People directory's third-party data, the two functional cookies, no analytics/
tracking/ads) as an Artifact from that thread; it still needs Jack's sign-off on
wording, a real contact method, and the copyright name before it replaces this
placeholder. Also worth another look once the audience actually shifts from "people
Jack invited personally" to strangers signing up on their own — that's the point
where the personal/household-use exemption most privacy law (UK GDPR included, since
Jack's in the UK) leans on gets shakier, and real legal advice becomes worth getting
rather than just a plain-language notice.

## Monetisation: a donation link, and whether to run ads

Jack wants to eventually support Stacks financially now that it's growing beyond his own
household (see the "Write the real privacy notice" idea above for the same wider-rollout
context). Since Stacks isn't a registered company, any money has to go to Jack personally,
not a business account. Talked through in a project thread on 2026-09-22:

- **Donations: Buy Me a Coffee, not Ko-fi.** Both were compared on fee structure before
  deciding — Ko-fi's free "Standard" tier actually charges the same 5% platform fee as Buy Me
  a Coffee (0% only comes with Ko-fi's $12/month "Gold" tier, confirmed against Ko-fi's own
  pricing page rather than third-party blog summaries, which turned out to be stale). With
  cost equal at the free tier, Jack picked Buy Me a Coffee for its clearer, more
  internationally self-explanatory name — better suited to his dad's non-technical,
  worldwide book-sharing contacts than the "Ko-fi" brand. Implementation would just be a
  "Support Stacks" link out to Jack's Buy Me a Coffee page (footer or Settings), no in-app
  payment handling. Ko-fi Gold's $12/month would only start paying for itself once monthly
  donations clear roughly £200+, so not worth reconsidering unless this genuinely takes off.
  Worth a reminder if it ever generates real, regular money: casual/occasional donations read
  as gifts for UK tax purposes, but the UK's £1,000/year trading allowance is the threshold
  past which Jack would need to register for Self Assessment and declare it as income.
- **Advertising: not pursuing it for now.** The idea was a desktop sidebar ad (there's a lot
  of unused horizontal whitespace on wide screens), but Stacks is a private, logged-in tool
  for a small network of people Jack's dad personally knows, not a content site with the kind
  of anonymous traffic volume ad networks need to pay meaningfully — realistic revenue at
  this scale would be negligible. It would also pull forward work that isn't needed yet: UK
  GDPR/PECR requires cookie consent for ad-tracking cookies, and `/privacy` is still just a
  placeholder (see the idea above). Revisit only if the user base becomes genuinely large and
  public rather than "people Jack knows" — which is also the point the privacy notice needs
  finishing anyway, so the two ideas move together.

## Rename a library

There's currently no way to change a `Library.name` after creation -- Settings has no
rename field, and `POST /api/library` only ever sets the name once, at creation. Jack
flagged this is coming eventually (raised in a project thread on 2026-09-23 while
discussing putting a library identifier in the URL for shareable links -- that URL work
shipped as `Library.code`, a stable random "L-XXXXXX" code chosen specifically *because* it
doesn't derive from the name, unlike the existing `Library.slug` field, so a future rename
won't break any `/{code}/...` link -- see "Library-code URL routing" in CLAUDE.md's "Data
model" section). Needs its own pass: at minimum a Settings field + `PATCH /api/library`
(Owner/Admin, same tier as other settings mutations), and a decision on whether
`Library.slug` (currently only used in backup export filenames) should regenerate on rename
or stay frozen from creation.

## Remaining solid-black button holdouts

The button-color rule confirmed with Jack (project thread, 2026-09-26 -- see CHANGELOG
8.4.0) is: solid red (`bg-accent`) for the primary/confirming action on a screen, bordered
black text for secondary/neutral, bordered red text for a caution/reversible-but-undoing
action. Three flagged instances (book detail Reserve, Settings "Add shelf", Settings
shelf-edit Save) were switched from solid black to solid red as part of that PR. A few more
solid-black (`bg-ink`) buttons don't match the rule but weren't touched since they weren't
what Jack flagged: the login page's "Sign in" button, the old Shelf-detail page's per-row
Reserve button (`copy-row.tsx` -- the page that intentionally still uses the older, simpler
`CopyRow` component per the "Scope notes" section of CLAUDE.md), the note-save buttons
(`copy-notecard.tsx`, `note-popup.tsx`), the library switcher's "Create" button
(`library-switcher.tsx`), and the invite-accept overlay's "Join" button
(`invite-accept-overlay.tsx`). Worth a single follow-up pass to bring all of these onto
`bg-accent` for consistency, once Jack confirms he wants the same treatment rather than
just the three call sites he originally flagged.
## Admin dashboard (stacksonline.com/admin/dashboard)

A backend view into the data Stacks stores across its libraries -- something beyond what any
single library's own Settings page exposes -- with read access at minimum and write where it
makes sense (e.g. the account-enumeration and abuse questions this raises need answering
first for anything destructive). Raised by Jack on 2026-09-25, flagged as needing more
discussion before building -- see the project thread for a rundown of the options (an in-app
`/admin` route gated by some notion of a super-admin role that doesn't exist yet vs.
off-the-shelf tooling like Prisma Studio, the Neon console, or a third-party admin builder
such as AdminJS or Retool pointed at the same Postgres database) and their tradeoffs. Ties
into the still-open "delete your own account" work and the wider-rollout plans (see the
"Monetisation" idea above) -- the bigger Stacks' user base gets, the more a real admin surface
matters, and the more that surface itself becomes something to secure carefully.
