# Deployment & Backend Management Guide

## Overview

Your Next.js app and Supabase work together:
- **Next.js App** → Deployed to Vercel (or other hosting)
- **Supabase** → Hosts your database, authentication, and storage

## Part 1: Deploying Your Next.js App

### Option A: Deploy to Vercel (Recommended - Free & Easy)

Vercel is the best platform for Next.js apps and integrates seamlessly with Supabase.

#### Step 1: Push Your Code to GitHub

1. **Create a GitHub repository:**
   ```bash
   # In your project directory
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Create a new repo on GitHub:**
   - Go to [github.com](https://github.com)
   - Click "New repository"
   - Name it (e.g., "truckmates-app")
   - Don't initialize with README
   - Click "Create repository"

3. **Push your code:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/truckmates-app.git
   git branch -M main
   git push -u origin main
   ```

#### Step 2: Deploy to Vercel

1. **Go to [vercel.com](https://vercel.com)**
   - Sign up/login with GitHub

2. **Import your project:**
   - Click "Add New" → "Project"
   - Select your GitHub repository
   - Click "Import"

3. **Configure environment variables:**
   - In Vercel project settings, go to **Settings** → **Environment Variables**
   - Add these variables:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
     ```
   - Make sure to add them for **Production**, **Preview**, and **Development**

4. **Deploy:**
   - Click "Deploy"
   - Wait 2-3 minutes
   - Your app will be live at `https://your-app.vercel.app`

#### Step 3: Update Supabase Allowed URLs

1. Go to Supabase dashboard → **Authentication** → **URL Configuration**
2. Add your Vercel URL to **Site URL** and **Redirect URLs**:
   - `https://your-app.vercel.app`
   - `https://your-app.vercel.app/**`

### Option B: Deploy to Other Platforms

**Netlify:**
- Similar to Vercel
- Connect GitHub repo
- Add environment variables
- Deploy

**Railway/Render:**
- Good for full-stack apps
- Connect GitHub
- Add environment variables
- Deploy

## Part 2: Managing Your Supabase Backend

### Accessing Supabase Dashboard

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. You'll see the main dashboard with:
   - **Table Editor** - View/edit data
   - **SQL Editor** - Run SQL queries
   - **Authentication** - Manage users
   - **Storage** - File management
   - **Database** - Schema management
   - **API** - API documentation

### 1. Database Management

#### View/Edit Data (Table Editor)

1. **Go to Table Editor:**
   - Click **"Table Editor"** in left sidebar
   - Select a table (e.g., `drivers`, `trucks`)

2. **View data:**
   - See all rows in a table
   - Filter, sort, search

3. **Add new row:**
   - Click **"Insert row"**
   - Fill in the form
   - Click **"Save"**

4. **Edit row:**
   - Click on any cell to edit
   - Press Enter or click outside to save

5. **Delete row:**
   - Click the row number (left side)
   - Click **"Delete"** button

#### Run SQL Queries (SQL Editor)

1. **Go to SQL Editor:**
   - Click **"SQL Editor"** in left sidebar
   - Click **"New query"**

2. **Write and run SQL:**
   ```sql
   -- Example: Get all drivers
   SELECT * FROM drivers;
   
   -- Example: Update a driver
   UPDATE drivers 
   SET status = 'active' 
   WHERE id = 'driver-uuid-here';
   
   -- Example: Create a new company
   INSERT INTO companies (name, email, phone)
   VALUES ('New Company', 'company@example.com', '+1234567890');
   ```

3. **Click "Run"** (or Cmd/Ctrl + Enter)

4. **Save queries:**
   - Click **"Save"** to save frequently used queries
   - Access saved queries from the sidebar

#### Modify Database Schema

1. **Go to Database:**
   - Click **"Database"** → **"Tables"**
   - See all your tables

2. **Add a new column:**
   - Click on a table
   - Click **"Add column"**
   - Fill in:
     - Column name
     - Type (text, integer, boolean, etc.)
     - Default value (optional)
     - Constraints (nullable, unique, etc.)
   - Click **"Save"**

3. **Modify existing column:**
   - Click on the column
   - Edit properties
   - Click **"Save"**

4. **Create a new table:**
   - Click **"New table"**
   - Add columns
   - Set primary key
   - Click **"Save"**

5. **Or use SQL:**
   ```sql
   -- Add a column
   ALTER TABLE drivers 
   ADD COLUMN emergency_contact TEXT;
   
   -- Create a new table
   CREATE TABLE notifications (
     id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
     user_id UUID REFERENCES users(id),
     message TEXT NOT NULL,
     read BOOLEAN DEFAULT false,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

#### Database Migrations (Advanced)

For production apps, use migrations to track schema changes:

1. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Login:**
   ```bash
   supabase login
   ```

3. **Link your project:**
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. **Create a migration:**
   ```bash
   supabase migration new add_notifications_table
   ```

5. **Edit the migration file** in `supabase/migrations/`

6. **Apply migration:**
   ```bash
   supabase db push
   ```

### 2. Authentication Management

#### View Users

1. **Go to Authentication:**
   - Click **"Authentication"** → **"Users"**
   - See all registered users

2. **View user details:**
   - Click on a user
   - See email, metadata, last sign in, etc.

3. **Edit user:**
   - Change email, password
   - Add metadata
   - Disable/enable user

4. **Delete user:**
   - Click **"Delete user"**

#### Configure Authentication

1. **Go to Authentication** → **Providers:**
   - Enable/disable providers (Email, Google, GitHub, etc.)
   - Configure OAuth settings

2. **Email Templates:**
   - Customize welcome emails
   - Password reset emails
   - Email confirmation templates

3. **URL Configuration:**
   - Set site URL
   - Add redirect URLs
   - Configure allowed domains

### 3. Storage Management

#### View Files

1. **Go to Storage:**
   - Click **"Storage"** in left sidebar
   - Select a bucket (e.g., `documents`)

2. **View files:**
   - See all uploaded files
   - Download files
   - View file details

3. **Upload files:**
   - Click **"Upload file"**
   - Select file(s)
   - Click **"Upload"**

4. **Delete files:**
   - Select file(s)
   - Click **"Delete"**

#### Manage Buckets

1. **Create new bucket:**
   - Click **"New bucket"**
   - Name it (e.g., `receipts`, `invoices`)
   - Set public/private
   - Click **"Create bucket"**

2. **Set bucket policies:**
   - Click on bucket → **"Policies"**
   - Create policies for read/write/delete access

### 4. Row Level Security (RLS) Policies

#### View Policies

1. **Go to Authentication** → **Policies:**
   - See all RLS policies
   - View policy details

2. **Edit policy:**
   - Click on a policy
   - Modify SQL
   - Click **"Save"**

#### Create New Policy

1. **Go to Table Editor:**
   - Select a table
   - Click **"Policies"** tab

2. **Create policy:**
   - Click **"New policy"**
   - Choose policy type (SELECT, INSERT, UPDATE, DELETE)
   - Write policy SQL:
   ```sql
   -- Example: Allow users to view their own data
   CREATE POLICY "Users can view own data"
   ON table_name FOR SELECT
   USING (auth.uid() = user_id);
   ```

### 5. API Management

#### View API Documentation

1. **Go to API:**
   - Click **"API"** in left sidebar
   - See auto-generated API docs
   - View table endpoints
   - Test API calls

#### Use REST API

Your Supabase project has a REST API:

```
GET https://your-project.supabase.co/rest/v1/drivers
Headers:
  apikey: your-anon-key
  Authorization: Bearer your-anon-key
```

#### Use Realtime

Enable realtime subscriptions for live updates:

1. **Go to Database** → **Replication:**
   - Enable replication for tables you want realtime updates
   - Use in your app for live data

### 6. Monitoring & Logs

#### View Logs

1. **Go to Logs:**
   - Click **"Logs"** in left sidebar
   - View:
     - API logs
     - Auth logs
     - Postgres logs
     - Realtime logs

2. **Filter logs:**
   - By date/time
   - By log type
   - Search logs

#### Monitor Performance

1. **Go to Reports:**
   - See database performance
   - API usage
   - Storage usage
   - Active users

## Part 3: Local Development with Supabase

### Option 1: Use Remote Supabase (Easiest)

Just use your remote Supabase project:
- Set `.env.local` with your project URL and keys
- All changes sync immediately

### Option 2: Local Supabase (Advanced)

Run Supabase locally for development:

1. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Start local Supabase:**
   ```bash
   supabase start
   ```

3. **Get local credentials:**
   ```bash
   supabase status
   ```

4. **Update `.env.local`:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=local-anon-key
   ```

5. **Stop local Supabase:**
   ```bash
   supabase stop
   ```

## Part 4: Best Practices

### 1. Environment Variables

**Never commit `.env.local` to Git!**

- ✅ Add `.env.local` to `.gitignore`
- ✅ Use Vercel environment variables for production
- ✅ Use different Supabase projects for dev/staging/production

### 2. Database Changes

- ✅ Test changes in development first
- ✅ Use migrations for production changes
- ✅ Backup database before major changes
- ✅ Document schema changes

### 3. Security

- ✅ Always use RLS policies
- ✅ Never expose service role key in client
- ✅ Use environment variables for all secrets
- ✅ Regularly review RLS policies

### 4. Performance

- ✅ Add indexes for frequently queried columns
- ✅ Use pagination for large datasets
- ✅ Monitor query performance in logs
- ✅ Use Supabase caching when possible

## Quick Reference

### Common Tasks

**Add a new table:**
```sql
CREATE TABLE my_table (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Add a column:**
```sql
ALTER TABLE drivers ADD COLUMN new_field TEXT;
```

**Update data:**
```sql
UPDATE drivers SET status = 'active' WHERE id = 'uuid';
```

**Delete data:**
```sql
DELETE FROM drivers WHERE id = 'uuid';
```

**Create RLS policy:**
```sql
CREATE POLICY "policy_name"
ON table_name FOR SELECT
USING (company_id IN (
  SELECT company_id FROM users WHERE id = auth.uid()
));
```

## Need Help?

- 📚 [Supabase Docs](https://supabase.com/docs)
- 💬 [Supabase Discord](https://discord.supabase.com)
- 🎥 [Supabase YouTube](https://www.youtube.com/c/supabase)
- 📖 [Supabase Blog](https://supabase.com/blog)

