# Setting Up Real Notifications

## Current Status

✅ **Database & Preferences**: Done
- Notification preferences are saved to the database
- Settings persist across sessions
- Each user has their own preferences

⚠️ **Email Sending**: Needs Setup
- The notification system is ready
- You need to configure email sending

---

## Step 1: Run the Database Migration

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open the file `supabase/notifications_schema.sql`
3. Copy and paste the SQL into the editor
4. Click **"Run"**
5. This creates the `notification_preferences` table

---

## Step 2: Choose Email Service

You have 3 options:

### Option A: Supabase Edge Functions (Recommended)
- Built into Supabase
- Free tier available
- Easy to set up

### Option B: Resend (Easy & Modern)
- Great developer experience
- Free tier: 3,000 emails/month
- Simple API

### Option C: SendGrid (Enterprise)
- More features
- Free tier: 100 emails/day
- More complex setup

---

## Step 3: Implement Email Sending

### If Using Resend (Recommended):

1. **Sign up at [resend.com](https://resend.com)**
2. **Get API key** from dashboard
3. **Add to environment variables:**
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   ```

4. **Install Resend:**
   ```bash
   npm install resend
   ```

5. **Update `app/actions/notifications.ts`:**
   ```typescript
   import { Resend } from 'resend'
   
   const resend = new Resend(process.env.RESEND_API_KEY)
   
   // In sendNotification function:
   await resend.emails.send({
     from: 'TruckMates <notifications@yourdomain.com>',
     to: userData.email,
     subject: getSubjectForType(type),
     html: getEmailTemplate(type, data),
   })
   ```

### If Using Supabase Edge Functions:

1. **Create Edge Function** in Supabase
2. **Deploy email sending function**
3. **Call from your server actions**

---

## Step 4: Add Notification Triggers

The notification system is ready, but you need to call it when events happen.

### Example: Send notification when route is updated

In `app/actions/routes.ts`, after updating a route:

```typescript
import { sendNotification } from './notifications'

// After route update:
if (result.data) {
  // Get all users in the company who want route updates
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('company_id', userData.company_id)
  
  // Send notifications
  for (const user of users || []) {
    await sendNotification(user.id, 'route_update', {
      routeName: result.data.name,
      status: result.data.status,
    })
  }
}
```

### Integration Points:

1. **Route Updates**: `app/actions/routes.ts` → `updateRoute()`
2. **Load Updates**: `app/actions/loads.ts` → `updateLoad()`
3. **Maintenance Alerts**: `app/actions/maintenance.ts` → `createMaintenance()`
4. **Payment Reminders**: `app/actions/accounting.ts` → `createSettlement()`

---

## Step 5: Test Notifications

1. **Enable a notification type** in Settings
2. **Trigger the event** (e.g., update a route)
3. **Check your email** for the notification

---

## Current Implementation Status

✅ **What Works:**
- Notification preferences are saved to database
- Settings persist across sessions
- System checks preferences before sending
- Ready to integrate with email service

⏳ **What Needs Setup:**
- Email service configuration (Resend/SendGrid/etc.)
- Email templates
- Integration points in action files

---

## Quick Start (Resend)

1. Run the SQL migration
2. Sign up for Resend
3. Add `RESEND_API_KEY` to `.env.local`
4. Install: `npm install resend`
5. Update `sendNotification()` function
6. Test!

---

## Need Help?

The notification system is 90% done. You just need to:
1. Run the SQL migration
2. Choose an email service
3. Add the email sending code

Let me know which email service you want to use, and I can help you set it up!

