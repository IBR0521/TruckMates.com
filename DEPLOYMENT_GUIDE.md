# Deployment Guide - TruckMates Platform

## Pre-Deployment Checklist

✅ **Build Status:** Build completed successfully  
✅ **Environment Variables:** `.env.local` is gitignored (won't be committed)  
✅ **All Features:** Ready for deployment (OpenAI API can be added later)

## Deployment Options

### Option 1: Vercel (Recommended - Easiest)

Vercel is the recommended platform for Next.js applications.

#### Steps:

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```
   - Follow the prompts
   - It will ask if you want to link to an existing project or create a new one
   - Choose your settings

4. **Set Environment Variables in Vercel Dashboard**:
   - Go to your project on https://vercel.com
   - Navigate to: **Settings → Environment Variables**
   - Add these variables:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
     ```
   - **Optional** (add later when needed):
     ```
     OPENAI_API_KEY=sk-your-key-here
     GOOGLE_MAPS_API_KEY=your-google-maps-key
     TWILIO_ACCOUNT_SID=your-twilio-sid
     TWILIO_AUTH_TOKEN=your-twilio-token
     ```

5. **Redeploy** after adding environment variables:
   - Go to **Deployments** tab
   - Click the three dots on the latest deployment
   - Click **Redeploy**

#### Production Deployment:
```bash
vercel --prod
```

---

### Option 2: Deploy via Vercel Dashboard (No CLI)

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Go to Vercel**:
   - Visit: https://vercel.com
   - Click **"Add New Project"**
   - Import your GitHub repository
   - Vercel will auto-detect Next.js settings

3. **Configure Environment Variables** (same as above)

4. **Deploy**: Click "Deploy"

---

### Option 3: Other Platforms

#### Netlify:
```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

#### Railway:
- Connect your GitHub repo
- Railway auto-detects Next.js
- Add environment variables in dashboard

#### AWS/Google Cloud/Azure:
- Use their respective Next.js deployment guides
- Requires more configuration

---

## Required Environment Variables

### **Required (Must Have):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### **Optional (Add Later):**
```env
# For document upload AI analysis
OPENAI_API_KEY=sk-your-key-here

# For Google Maps (Fleet Map, Route Optimization)
GOOGLE_MAPS_API_KEY=your-google-maps-key

# For SMS notifications
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token

# For email notifications
RESEND_API_KEY=re_your-key-here
RESEND_FROM_EMAIL=TruckMates <notifications@yourdomain.com>
```

---

## Post-Deployment Steps

### 1. **Run Database Migrations**
Make sure all SQL schemas are applied in Supabase:
- `supabase/schema.sql`
- `supabase/crm_schema_complete.sql`
- `supabase/storage_bucket_setup.sql` (for document uploads)
- Any other schema files you've created

### 2. **Test the Deployment**
- Visit your deployed URL
- Test login/registration
- Test creating a driver, truck, load, etc.
- Verify all features work

### 3. **Set Up Custom Domain** (Optional)
- In Vercel: **Settings → Domains**
- Add your custom domain
- Update DNS records as instructed

---

## Features That Work Without API Keys

✅ **All Core Features:**
- User authentication
- Driver management
- Vehicle management
- Load management
- Route management
- Customer/Vendor management
- Invoicing
- Expenses
- Maintenance tracking
- Reports & Analytics
- Fleet Map (basic - without Google Maps it shows list view)
- BOL management
- Address Book

⚠️ **Features That Need API Keys:**
- **Document Upload AI Analysis** - Needs `OPENAI_API_KEY` (will show error, but upload still works)
- **Fleet Map Live Tracking** - Needs `GOOGLE_MAPS_API_KEY` (shows list view instead)
- **Route Optimization** - Needs `GOOGLE_MAPS_API_KEY` (uses basic distance calculation)
- **SMS Notifications** - Needs Twilio keys (silently fails, doesn't break functionality)

---

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Run `npm install` locally first
- Check for TypeScript errors: `npm run build`

### Environment Variables Not Working
- Make sure variable names match exactly (case-sensitive)
- Redeploy after adding variables
- Check Vercel logs for errors

### Database Connection Issues
- Verify Supabase URL and keys are correct
- Check Supabase project is active
- Verify RLS policies are set up

### 404 Errors on Routes
- Make sure you're using Next.js 16 (App Router)
- Check that all page files are in `app/` directory
- Verify file structure matches routes

---

## Quick Deploy Command (Vercel)

```bash
# One-time setup
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

---

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Ensure database migrations are complete

---

**Note:** The platform is fully functional without the OpenAI API key. Document upload will work, but AI analysis will show an error message. Users can still manually enter data from documents.

