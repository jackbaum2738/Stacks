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

## Email signature for Gmail

Jack sends some Stacks-related emails by hand from `info@stacksonline.com` (not
through the app) and wants a signature block he can paste into Gmail's own
signature editor, matching the shared transactional-email header/footer identity
another thread is standardizing (see CLAUDE.md's "Tech stack" section once that
work lands, or the email mockup thread if it's still open): the Stacks mark +
"Stacks" wordmark, then `stacksonline.com` and a Privacy Policy link, then
`© 2026 Jack Baum`.

Gmail's signature editor strips most markup on paste (no custom fonts, limited
CSS, no `@font-face` or CSS variables), so this can't just be a copy of the email
template's HTML -- it needs its own simplified build: the mark as an actual
`<img>` (a hosted PNG/SVG export, not inline SVG, since Gmail unreliably keeps
inline SVG on paste) sized to email proportions, the wordmark as plain styled
text in a Gmail-safe fallback font stack (Gmail won't load Newsreader/Karla from
`next/font`), and the two footer lines as plain text with real `stacksonline.com`
and Privacy Policy hyperlinks -- no CSS custom properties, no `@media` dark-mode
block, since Gmail's signature editor doesn't support either. Worth building
right after the shared email header/footer partial lands, so the hosted logo
asset and the real Privacy Policy URL only need to be produced once and reused
in both places.
