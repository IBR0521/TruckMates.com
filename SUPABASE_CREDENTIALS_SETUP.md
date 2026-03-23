# Supabase Credentials Setup

## Your Supabase Configuration

Get values from **Supabase Dashboard → Project Settings → API** (never commit real keys to git).

### Supabase Project URL

```
https://YOUR_PROJECT_REF.supabase.co
```

### Anon/Public Key (for client-side)

Paste the **anon public** JWT from the dashboard.

### Service Role Key (for server-side only - NEVER expose to client)

Paste the **service_role** JWT from the dashboard. Use only in server-side code and `.env.local` / Vercel.

---

## Setup Instructions

### For Local Development (.env.local)

Create or update `.env.local` in the project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_jwt_from_dashboard

# Optional: Service Role Key (server-side only)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_jwt_from_dashboard

# App URL (for local development)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**After creating/updating `.env.local`:**
1. Restart your development server (`npm run dev`)
2. The platform should now connect to Supabase

---

### For Production (Vercel)

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select your project**
3. **Go to**: Settings → Environment Variables
4. **Add** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and optionally `SUPABASE_SERVICE_ROLE_KEY` using the same values as in Supabase (Production, Preview, Development as needed).

5. **After adding variables, redeploy** your project.

6. **Verify**: visit `/diagnostics` if your app exposes it.

---

## Security Notes

⚠️ **Important Security Reminders:**

1. **Never commit `.env.local` to git** - It's already in `.gitignore`
2. **Never expose Service Role Key** - Only use in server-side code
3. **Rotate keys** if they were ever pasted into docs, chat, or screenshots

---

## Troubleshooting

### Still seeing connection errors?

1. **Check environment variables** in Vercel and local `.env.local`
2. **Redeploy** after changing Vercel env
3. **Verify Supabase project is active** (not paused)
4. **Check `/diagnostics`** for specific error messages

### Common Issues

**"Missing Supabase environment variables"**
- Solution: Add variables to Vercel / `.env.local` and redeploy

**"Invalid Supabase URL format"**
- Solution: URL must be `https://YOUR_PROJECT_REF.supabase.co` (from dashboard)

**"Connection timeout"**
- Solution: Check if Supabase project is active, check network connection

---

## Next Steps

1. Set up `.env.local` for local development
2. Add environment variables to Vercel
3. Redeploy production
4. Test using `/diagnostics` and login
