# Fix “failed to fetch” / Supabase after `.env.local` changes

We should only have **added** the trip/map keys, not replaced your whole env file. Sorry.

## Fastest fix (recommended)

From the project folder, pull **all** variables from your Vercel project (includes Supabase + the API keys already stored there):

```bash
npx vercel login
npx vercel link
npx vercel env pull .env.local
```

That **rewrites** `.env.local` with everything Vercel has. Then restart:

```bash
npm run dev
```

If any trip key was only on your machine and not in Vercel, add that line again at the bottom of `.env.local`.

## Manual fix

In Vercel → **Settings → Environment Variables**, copy **`NEXT_PUBLIC_SUPABASE_URL`** and **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** (and anything else you use) into `.env.local` with real values — **never** leave them as `KEY=` with nothing after the `=`.

## Why fetch broke

Empty lines like `NEXT_PUBLIC_SUPABASE_URL=` set the variable to an **empty string**. The app still tries to use Supabase and requests fail (“failed to fetch”). Missing vars are handled differently than blank ones.

## “Email service not configured” yellow banner

That banner is **not** from Supabase. The dashboard checks **`RESEND_API_KEY`** (or company Resend settings in **Settings → Integration**). If you merged env by hand and only added Supabase + map keys, **add `RESEND_API_KEY`** from Vercel or Resend, or use **`vercel env pull`** so Resend is included. Until then you can click **Dismiss** (it’s remembered in the browser).
