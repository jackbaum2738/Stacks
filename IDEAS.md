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

## Light / dark / system theme setting

The app already fully supports light and dark mode (it follows the
system/browser preference throughout), but there's no in-app control to
override that. Add a theme preference to Settings — Light / Dark / Match
system — stored per user (or per library?) so it persists across visits
regardless of what the OS is set to.
