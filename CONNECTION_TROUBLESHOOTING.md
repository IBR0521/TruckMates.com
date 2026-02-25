# Connection Troubleshooting Guide

## Quick Fixes

### 1. Check Environment Variables

Make sure `.env.local` exists and has correct values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**To verify:**
```bash
# Check if file exists
ls -la .env.local

# View contents (be careful not to commit this!)
cat .env.local
```

### 2. Restart Development Server

```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

### 3. Check Supabase Project Status

1. Go to https://supabase.com/dashboard
2. Verify your project is active
3. Check if there are any service interruptions
4. Verify your API keys are correct

### 4. Test Connection

Visit: http://localhost:3000/api/health

Expected response:
```json
{
  "status": "ok",
  "message": "Connection successful"
}
```

If you see an error, check the error message for details.

### 5. Clear Cache and Restart

```bash
# Remove Next.js cache
rm -rf .next

# Restart server
npm run dev
```

### 6. Check Network Connection

```bash
# Test internet connectivity
ping google.com

# Test Supabase connectivity
curl https://your-project.supabase.co
```

## Common Error Messages

### "Missing Supabase environment variables"
**Solution:** Create `.env.local` file with your Supabase credentials

### "Connection timeout"
**Solution:** 
- Check your internet connection
- Verify Supabase URL is correct
- Check firewall settings

### "Failed to connect to database"
**Solution:**
- Verify Supabase project is active
- Check API keys are correct
- Ensure RLS policies allow access

### "ECONNREFUSED"
**Solution:**
- Supabase service might be down
- Check Supabase status page
- Verify network connectivity

## Advanced Troubleshooting

### Check Server Logs

Look for error messages in your terminal where `npm run dev` is running.

### Test Supabase Connection Directly

```bash
# Using curl
curl -H "apikey: YOUR_ANON_KEY" \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     https://YOUR_PROJECT.supabase.co/rest/v1/
```

### Verify Environment Variables Are Loaded

Add this temporarily to a page to check:

```typescript
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('Has Anon Key:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
```

## Still Having Issues?

1. **Check Supabase Dashboard:**
   - Go to Settings → API
   - Verify URL and keys match your `.env.local`

2. **Check Browser Console:**
   - Open DevTools (F12)
   - Look for network errors
   - Check console for error messages

3. **Check Server Logs:**
   - Look at terminal where `npm run dev` is running
   - Check for error messages

4. **Contact Support:**
   - If Supabase is down, check their status page
   - If issue persists, check project logs

## Prevention

- Always keep `.env.local` up to date
- Don't commit `.env.local` to git
- Use `.env.example` as a template
- Regularly check Supabase project status








