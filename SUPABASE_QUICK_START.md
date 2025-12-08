# Supabase Quick Start Guide

## Step 1: Install Dependencies

The Supabase packages have been installed. If you need to reinstall:

```bash
npm install @supabase/supabase-js @supabase/ssr
```

## Step 2: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/login
2. Click **"New Project"**
3. Fill in:
   - **Name**: TruckMates
   - **Database Password**: (save this password!)
   - **Region**: Choose closest to your users
4. Wait 1-2 minutes for setup

## Step 3: Get Your API Keys

1. In Supabase dashboard → **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public key** (long string starting with `eyJ...`)

## Step 4: Set Up Environment Variables

1. Create `.env.local` file in project root:
   ```bash
   cp env.example .env.local
   ```

2. Edit `.env.local` and add your keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Important**: Restart your dev server after adding env variables:
   ```bash
   npm run dev
   ```

## Step 5: Set Up Database Schema

1. In Supabase dashboard → **SQL Editor**
2. Click **"New query"**
3. Open `supabase/schema.sql` from this project
4. Copy ALL the SQL code
5. Paste into Supabase SQL Editor
6. Click **"Run"** (or press Cmd/Ctrl + Enter)
7. Wait for "Success" message

This creates:
- ✅ All tables (drivers, trucks, routes, loads, invoices, etc.)
- ✅ Indexes for performance
- ✅ Row Level Security (RLS) policies
- ✅ Automatic timestamp triggers

## Step 6: Set Up Storage (for file uploads)

1. In Supabase dashboard → **Storage**
2. Click **"Create a new bucket"**
3. Create bucket named: **`documents`**
   - Make it **Public**: No (private)
   - Click **"Create bucket"**

4. Set up storage policies:
   - Go to **Storage** → **Policies** → **documents** bucket
   - Click **"New Policy"** → **"For full customization"**
   - Add this policy:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Allow users to read documents
CREATE POLICY "Users can read documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- Allow users to delete their documents
CREATE POLICY "Users can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
```

## Step 7: Test the Setup

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Try to register a new user at `/register/manager`
3. Check Supabase dashboard → **Authentication** → **Users** to see if user was created

## Step 8: Create Your First Company

After registering, you need to create a company:

1. Go to Supabase dashboard → **Table Editor** → **companies**
2. Click **"Insert row"**
3. Fill in:
   - **name**: Your Company Name
   - **email**: company@example.com
   - **phone**: +1234567890
4. Click **"Save"** and copy the **id** (UUID)

5. Go to **users** table
6. Find your user (by email)
7. Update:
   - **company_id**: Paste the company UUID
   - **role**: `manager`
8. Click **"Save"**

## Next Steps

Now you can:

1. ✅ **Use database queries** - Helper functions are in `lib/supabase/queries.ts`
2. ✅ **Update components** - Replace mock data with Supabase queries
3. ✅ **Implement authentication** - Login/register pages can use Supabase auth
4. ✅ **Upload files** - Documents can be uploaded to Supabase Storage

## Example: Using Database in Components

```typescript
// In a Server Component
import { getDrivers, getUserCompanyId } from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/server"

export default async function DriversPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return <div>Not authenticated</div>
  
  const companyId = await getUserCompanyId(user.id)
  if (!companyId) return <div>No company assigned</div>
  
  const { data: drivers, error } = await getDrivers(companyId)
  
  if (error) return <div>Error loading drivers</div>
  
  return (
    <div>
      {drivers?.map(driver => (
        <div key={driver.id}>{driver.name}</div>
      ))}
    </div>
  )
}
```

## Troubleshooting

### "Invalid API key" error
- ✅ Check `.env.local` has correct values
- ✅ Restart dev server: `npm run dev`
- ✅ Make sure keys don't have extra spaces

### RLS policies blocking queries
- ✅ Make sure user has `company_id` set in `users` table
- ✅ Check user's `role` is set correctly
- ✅ Verify RLS policies were created (check Supabase dashboard → **Authentication** → **Policies**)

### Can't upload files
- ✅ Make sure `documents` bucket exists
- ✅ Check storage policies are set up
- ✅ Verify user is authenticated

## Need Help?

- 📚 [Supabase Docs](https://supabase.com/docs)
- 💬 [Supabase Discord](https://discord.supabase.com)
- 🐛 Check browser console and terminal for errors

