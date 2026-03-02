# Troubleshooting Localhost Connection Failure

## Quick Fixes

### 1. Start the Development Server

```bash
# Stop any existing server (Ctrl+C)
# Then start fresh:
npm run dev
```

If port 3000 is busy, use the alternate port:
```bash
npm run dev:alt  # Uses port 3001
```

### 2. Verify Environment Variables

Check that your `.env.local` file has the correct Supabase credentials:

```bash
# View your .env.local (be careful not to commit this!)
cat .env.local
```

Required variables:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://ozzcdefgnutcotcgqruf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96emNkZWZnbnV0Y290Y2dxcnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDU0MTIsImV4cCI6MjA4NjM4MTQxMn0.27PGSSPQaLjdKoKvMwIMBLlyO_jvTHSCNRYg1w8eUwo
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Kill Processes on Port 3000

If port 3000 is already in use:

```bash
# Find and kill processes on port 3000
lsof -ti:3000 | xargs kill -9

# Or manually:
kill -9 47067 98988  # Replace with actual PIDs
```

Then restart:
```bash
npm run dev
```

### 4. Clear Next.js Cache

```bash
# Remove build cache
rm -rf .next

# Restart server
npm run dev
```

### 5. Check Browser Console

Open browser DevTools (F12) and check:
- Console tab for error messages
- Network tab for failed requests
- Look for "ECONNREFUSED" or "Connection timeout" errors

### 6. Verify Supabase Connection

Test if Supabase is accessible:
```bash
curl https://ozzcdefgnutcotcgqruf.supabase.co
```

If this fails, check your internet connection.

## Common Issues

### Issue: "Connection refused" or "ECONNREFUSED"
**Solution:** Dev server isn't running. Start it with `npm run dev`

### Issue: "Port 3000 already in use"
**Solution:** Kill the process using port 3000 or use `npm run dev:alt` for port 3001

### Issue: "Missing environment variables"
**Solution:** Ensure `.env.local` exists with correct Supabase credentials

### Issue: "Connection timeout"
**Solution:** 
- Check internet connection
- Verify Supabase project is active
- Check firewall settings

## Still Not Working?

1. **Check terminal output** - Look for error messages when running `npm run dev`
2. **Try different port** - Use `npm run dev:alt` for port 3001
3. **Restart everything** - Close terminal, restart, then run `npm run dev`
4. **Check Node version** - Ensure you're using Node.js 18+ (`node --version`)

