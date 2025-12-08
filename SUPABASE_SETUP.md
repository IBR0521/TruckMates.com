# Supabase Setup Guide for TruckMates

This guide will help you set up Supabase as the database and backend for your TruckMates application.

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in to your account
3. Click "New Project"
4. Fill in your project details:
   - **Name**: TruckMates (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose the region closest to your users
5. Click "Create new project" and wait for it to be set up (takes 1-2 minutes)

## Step 2: Get Your API Keys

1. In your Supabase project dashboard, go to **Settings** → **API**
2. You'll find:
   - **Project URL**: Copy this value
   - **anon/public key**: Copy this value
3. Keep these values safe - you'll need them in the next step

## Step 3: Set Up Environment Variables

1. In your project root, create a file named `.env.local` (if it doesn't exist)
2. Copy the contents from `.env.local.example`:
   ```bash
   cp .env.local.example .env.local
   ```
3. Open `.env.local` and replace the placeholder values:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```
4. Save the file

## Step 4: Set Up the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Open the file `supabase/schema.sql` from this project
4. Copy the entire contents of `schema.sql`
5. Paste it into the SQL Editor in Supabase
6. Click "Run" to execute the SQL
7. Wait for it to complete (you should see "Success. No rows returned")

This will create:
- All necessary tables (users, drivers, trucks, routes, loads, invoices, expenses, settlements, maintenance, IFTA reports, documents)
- Indexes for better performance
- Row Level Security (RLS) policies
- Triggers for automatic timestamp updates

## Step 5: Set Up Authentication

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Enable **Email** provider (it's enabled by default)
3. Optionally configure:
   - Email templates
   - Password requirements
   - Email confirmation settings

## Step 6: Set Up Storage (for document uploads)

1. In Supabase dashboard, go to **Storage**
2. Click "Create a new bucket"
3. Create buckets:
   - **documents**: For storing uploaded documents
   - **receipts**: For expense receipts (optional)
4. Set bucket policies:
   - Go to **Storage** → **Policies**
   - For each bucket, create policies that allow authenticated users to upload/read files

Example policy for documents bucket:
```sql
-- Allow authenticated users to upload files
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Allow users to read their company's documents
CREATE POLICY "Users can read documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');
```

## Step 7: Verify Installation

1. Make sure you've installed the dependencies:
   ```bash
   pnpm install
   ```

2. Start your development server:
   ```bash
   pnpm dev
   ```

3. Try to register a new user - it should create an entry in the `auth.users` table

## Step 8: Create Your First Company and User

After registering, you'll need to:

1. Go to Supabase dashboard → **Table Editor** → **companies**
2. Create a new company record
3. Go to **users** table and update your user record:
   - Set `company_id` to the company you just created
   - Set `role` to 'manager' if you're the admin

Or you can do this via SQL:
```sql
-- Create a company
INSERT INTO public.companies (name, email, phone)
VALUES ('Your Company Name', 'company@example.com', '+1234567890')
RETURNING id;

-- Update your user (replace 'your-user-id' with your actual user ID from auth.users)
UPDATE public.users
SET company_id = 'company-id-from-above', role = 'manager'
WHERE id = 'your-user-id';
```

## Next Steps

Now that Supabase is set up, you can:

1. **Update your components** to use Supabase instead of mock data
2. **Create API routes** or **Server Actions** for database operations
3. **Implement real authentication** in your login/register pages
4. **Add file upload functionality** for documents

## Useful Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Guide](https://supabase.com/docs/guides/storage)

## Troubleshooting

### "Invalid API key" error
- Make sure your `.env.local` file has the correct values
- Restart your development server after changing environment variables

### RLS policies blocking queries
- Check that your user has the correct `company_id` set
- Verify that RLS policies are correctly set up in the database

### Can't upload files
- Make sure storage buckets are created
- Check that storage policies allow your user to upload files

## Support

If you encounter any issues, check:
1. Supabase dashboard logs
2. Browser console for client-side errors
3. Terminal for server-side errors

