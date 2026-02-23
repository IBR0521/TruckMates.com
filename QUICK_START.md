# Quick Start Guide

## Starting the Platform

### 1. Start Development Server

```bash
npm run dev
```

The platform will be available at: **http://localhost:3000**

### 2. Check Environment Variables

Make sure you have a `.env.local` file with your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

See `env.example` for all available configuration options.

### 3. Troubleshooting Connection Issues

If you see "Connection failed" errors:

1. **Check Supabase Connection**:
   - Verify your `.env.local` file has correct Supabase credentials
   - Check if your Supabase project is active
   - Verify network connectivity

2. **Restart the Server**:
   ```bash
   # Kill any existing process
   lsof -ti:3000 | xargs kill -9
   
   # Start fresh
   npm run dev
   ```

3. **Clear Cache**:
   ```bash
   rm -rf .next
   npm run dev
   ```

4. **Check Database**:
   - Ensure Supabase tables are set up
   - Verify RLS policies are configured
   - Check database connection in Supabase dashboard

### 4. Performance Optimizations

The platform now includes:
- ✅ React Query for automatic caching
- ✅ Optimized bundle splitting
- ✅ Enhanced caching strategies
- ✅ Request deduplication

See `PERFORMANCE_OPTIMIZATIONS.md` for details.

### 5. Common Commands

```bash
# Development
npm run dev          # Start dev server

# Production
npm run build        # Build for production
npm start            # Start production server

# Linting
npm run lint         # Check code quality
```

---

**Platform URL**: http://localhost:3000
**Status**: ✅ Optimized for performance







