# Local development (localhost)

## 1. Environment variables

Vercel does **not** inject secrets into your laptop. Create **`/.env.local`** in the project root.

**Pull everything from Vercel (recommended):** install [Vercel CLI](https://vercel.com/docs/cli), then in the project folder:

```bash
vercel link          # once: connect to truck-mates-com
vercel env pull .env.local
```

That restores `NEXT_PUBLIC_SUPABASE_*` and all other keys in one step. Restart `npm run dev` after.

If you only maintain `.env.local` by hand, **never delete** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the app needs them for login and data.

**Fastest:** In Vercel → your project → **Settings → Environment Variables**, use **“Download .env”** (if available) or copy each name/value into `.env.local`.

Minimum to run the dashboard with auth + DB:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_APP_URL` | Set to `http://localhost:3000` |

Trip planning / maps (see `PROMILES.md`):

| Variable | Purpose |
|----------|---------|
| `GOOGLE_MAPS_API_KEY` | Geocoding + fallback routing (server) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps in the browser |
| `HERE_API_KEY` | Truck routing + toll estimate from HERE (optional) |
| `EIA_API_KEY` | Diesel price estimates (optional) |

Use **`.env.example`** as a checklist (no secrets in git).

## 2. Start the dev server

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. After **any** change to `.env.local`, **restart** `npm run dev`.

## 3. Port already in use

```bash
lsof -ti :3000 | xargs kill -9
npm run dev
```

## 4. “Too many open files” (macOS / Watchpack)

```bash
ulimit -n 10240
```

Then start the dev server again.
