# Stacks

A shared home-library tracker: scan a book's ISBN in or out of a physical library
(by USB/Bluetooth barcode scanner or a phone camera), look up its details
automatically (Google Books, with Open Library as a fallback), organize books
onto shelves, and reserve copies for specific people until you're ready to send
them off.

This is a rebuild of a personal Google Sheets + Apps Script tool as a proper
multi-user web app, designed so other people can eventually run their own
library in the same system.

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript) — pages and API routes in one codebase
- [Tailwind CSS](https://tailwindcss.com) — styling
- [PostgreSQL](https://www.postgresql.org) + [Prisma](https://www.prisma.io) — data storage and migrations
- Custom cookie-based auth (bcrypt + signed JWT) — no third-party auth service required

## Data model

- **Library** — one per person/household; has members and shelves
- **Shelf** — a physical shelf within a library
- **Book** — shared catalog metadata for a title (title, authors, cover, etc.), keyed by ISBN
- **Copy** — one physical copy of a `Book` sitting on a `Shelf` in a `Library`, with a status (available/reserved/removed)
- **Reservation** — holds a `Copy` for a named person until it's sent

## Local development

1. Have PostgreSQL running locally (or point `DATABASE_URL` at any Postgres instance).
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `AUTH_SECRET` (any long random string).
3. Install dependencies and set up the database:

   ```bash
   npm install
   npx prisma migrate dev
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

### Optional environment variables

- `GOOGLE_BOOKS_API_KEY` — raises the Google Books API rate limit; works without one at low volume.
- `OPEN_LIBRARY_CONTACT` — an email address included in the Open Library User-Agent header, per their API etiquette guidelines.
