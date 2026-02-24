# Supabase Credentials Setup

## Your Supabase Configuration

Based on your credentials, here are the values you need:

### Supabase Project URL
```
https://ozzcdefgnutcotcgqruf.supabase.co
```

### Anon/Public Key (for client-side)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96emNkZWZnbnV0Y290Y2dxcnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDU0MTIsImV4cCI6MjA4NjM4MTQxMn0.27PGSSPQaLjdKoKvMwIMBLlyO_jvTHSCNRYg1w8eUwo
```

### Service Role Key (for server-side only - NEVER expose to client)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96emNkZWZnbnV0Y290Y2dxcnVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgwNTQxMiwiZXhwIjoyMDg2MzgxNDEyfQ.g0z5t6hSIPqKxXpUVPx0P33mCqzy1fAINrNDBVUkrmw
```

---

## Setup Instructions

### For Local Development (.env.local)

Create or update `.env.local` file in the project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://ozzcdefgnutcotcgqruf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96emNkZWZnbnV0Y290Y2dxcnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDU0MTIsImV4cCI6MjA4NjM4MTQxMn0.27PGSSPQaLjdKoKvMwIMBLlyO_jvTHSCNRYg1w8eUwo

# Optional: Service Role Key (server-side only)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96emNkZWZnbnV0Y290Y2dxcnVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgwNTQxMiwiZXhwIjoyMDg2MzgxNDEyfQ.g0z5t6hSIPqKxXpUVPx0P33mCqzy1fAINrNDBVUkrmw

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
4. **Add the following variables:**

#### Variable 1: NEXT_PUBLIC_SUPABASE_URL
- **Name**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: `https://ozzcdefgnutcotcgqruf.supabase.co`
- **Environment**: ✅ Production, ✅ Preview, ✅ Development

#### Variable 2: NEXT_PUBLIC_SUPABASE_ANON_KEY
- **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96emNkZWZnbnV0Y290Y2dxcnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDU0MTIsImV4cCI6MjA4NjM4MTQxMn0.27PGSSPQaLjdKoKvMwIMBLlyO_jvTHSCNRYg1w8eUwo`
- **Environment**: ✅ Production, ✅ Preview, ✅ Development

#### Optional: SUPABASE_SERVICE_ROLE_KEY (for server-side operations)
- **Name**: `SUPABASE_SERVICE_ROLE_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96emNkZWZnbnV0Y290Y2dxcnVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgwNTQxMiwiZXhwIjoyMDg2MzgxNDEyfQ.g0z5t6hSIPqKxXpUVPx0P33mCqzy1fAINrNDBVUkrmw`
- **Environment**: ✅ Production, ✅ Preview, ✅ Development
- **⚠️ Important**: This key has admin access. Only use server-side, never expose to client.

5. **After adding variables, you MUST redeploy:**
   - Go to **Deployments** tab
   - Click **"..."** on the latest deployment
   - Click **"Redeploy"**
   - Wait for deployment to complete

6. **Verify the setup:**
   - Visit: `https://your-domain.com/diagnostics`
   - All checks should pass ✅

---

## Quick Verification

### Test Local Connection
```bash
# Start dev server
npm run dev

# Visit http://localhost:3000/diagnostics
# All checks should pass
```

### Test Production Connection
1. Visit: `https://your-domain.com/diagnostics`
2. All checks should show ✅
3. If any fail, check Vercel environment variables and redeploy

---

## Security Notes

⚠️ **Important Security Reminders:**

1. **Never commit `.env.local` to git** - It's already in `.gitignore`
2. **Never expose Service Role Key** - Only use in server-side code
3. **Anon Key is safe** - Can be used in client-side code (it's public)
4. **Service Role Key** - Has admin access, use with caution

---

## Troubleshooting

### Still seeing connection errors?

1. **Check environment variables are set correctly in Vercel**
2. **Make sure you redeployed after adding variables**
3. **Verify Supabase project is active** (not paused)
4. **Check `/diagnostics` page** for specific error messages
5. **Check Vercel deployment logs** for detailed errors

### Common Issues

**"Missing Supabase environment variables"**
- Solution: Add variables to Vercel and redeploy

**"Invalid Supabase URL format"**
- Solution: URL must be exactly: `https://ozzcdefgnutcotcgqruf.supabase.co`

**"Connection timeout"**
- Solution: Check if Supabase project is active, check network connection

---

## Next Steps

1. ✅ Set up `.env.local` for local development
2. ✅ Add environment variables to Vercel
3. ✅ Redeploy production
4. ✅ Test using `/diagnostics` page
5. ✅ Verify login/registration works

Your platform should now be fully connected! 🚀

