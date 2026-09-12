# Deploying Stacks

This app deploys to [Vercel](https://vercel.com) (hosts the Next.js app) with
[Neon](https://neon.tech) (hosts the Postgres database). Both have free tiers
suitable for this.

## 1. Create a Neon database

1. Sign up at [neon.tech](https://neon.tech) (GitHub login is fine).
2. Create a new project (any name/region).
3. From the project dashboard, copy the **connection string** — it looks like
   `postgresql://user:password@ep-something.region.aws.neon.tech/dbname?sslmode=require`.
   Use the **pooled** connection string if Neon offers both (labeled "Pooled
   connection"), since Vercel's serverless functions open many short-lived
   connections.

## 2. Create a Vercel project

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account.
2. "Add New… → Project", and import the `jackbaum2738/Stacks` repository.
3. Vercel auto-detects Next.js — leave the build settings as default.
4. Before deploying, add the environment variables below.

## 3. Environment variables (Vercel project → Settings → Environment Variables)

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | The Neon connection string from step 1 |
| `AUTH_SECRET` | A long random string (e.g. generate with `openssl rand -base64 32`) — **must be different from any value used locally** |
| `GOOGLE_BOOKS_API_KEY` | Optional — raises the Google Books rate limit |
| `OPEN_LIBRARY_CONTACT` | Optional — an email address for Open Library's API etiquette header |

## 4. Deploy

Click Deploy. Vercel will:

1. `npm install` (which also runs `prisma generate` via `postinstall`)
2. `prisma migrate deploy && next build` (applies any pending database
   migrations, then builds the app) — this runs automatically on every
   deploy, so schema changes ship themselves.

You'll get a live URL like `stacks-xyz.vercel.app`. Every future push to the
connected branch redeploys automatically.

## 5. Verify

Visit the URL, register an account, and try scanning a book (typing an ISBN
works fine without a barcode scanner or camera, e.g. `9780132350884`).

## Custom domain (optional)

Vercel project → Settings → Domains → add your domain and follow its DNS
instructions.
