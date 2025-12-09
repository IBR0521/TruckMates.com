# Setting Up Resend for Email Notifications

## Step 1: Sign Up for Resend

1. Go to [resend.com](https://resend.com)
2. Click **"Sign Up"** (free)
3. Sign up with your email or GitHub
4. Verify your email address

## Step 2: Get Your API Key

1. After logging in, go to **"API Keys"** in the left sidebar
2. Click **"Create API Key"**
3. Name it: `TruckMates Production` (or any name)
4. Select permission: **"Sending access"**
5. Click **"Add"**
6. **COPY THE API KEY** (starts with `re_...`)
   - ⚠️ You won't see it again!

## Step 3: Add API Key to Your Project

### For Local Development:

1. Open your `.env.local` file
2. Add this line:
   ```env
   RESEND_API_KEY=re_your_actual_api_key_here
   ```
3. Save the file
4. **Restart your dev server** (stop and run `npm run dev` again)

### For Vercel (Production):

1. Go to your Vercel project dashboard
2. Go to **Settings** → **Environment Variables**
3. Click **"Add New"**
4. Add:
   - **Name**: `RESEND_API_KEY`
   - **Value**: Your Resend API key (starts with `re_...`)
   - **Environments**: Check all three ✅
     - Production
     - Preview
     - Development
5. Click **"Save"**
6. **Redeploy** your app (or it will auto-deploy on next push)

## Step 4: Verify Domain (Optional but Recommended)

For production, you should verify your domain:

1. In Resend dashboard, go to **"Domains"**
2. Click **"Add Domain"**
3. Enter your domain (e.g., `yourdomain.com`)
4. Add the DNS records Resend provides to your domain provider
5. Wait for verification (usually a few minutes)

**For testing**, you can use Resend's default domain, but emails might go to spam.

📖 **Need detailed instructions?** See [RESEND_DOMAIN_VERIFICATION.md](./RESEND_DOMAIN_VERIFICATION.md) for a complete step-by-step guide with screenshots and troubleshooting tips.

## Step 5: Test It!

1. Go to your app → **Settings**
2. Make sure **"Email Alerts"** is enabled
3. Update a route or load
4. Check your email inbox!

---

## Current Status

✅ **Code is ready** - Email sending is implemented
✅ **Database ready** - Preferences are saved
⏳ **Needs API Key** - Add `RESEND_API_KEY` to environment variables

---

## Troubleshooting

### Emails not sending?

1. **Check API key is set:**
   - Make sure `RESEND_API_KEY` is in `.env.local` (local) or Vercel (production)
   - Restart dev server after adding to `.env.local`

2. **Check Resend dashboard:**
   - Go to Resend → **"Logs"**
   - See if emails are being sent
   - Check for any errors

3. **Check notification preferences:**
   - Make sure email alerts are enabled in Settings
   - Make sure the specific notification type is enabled

### Emails going to spam?

- Verify your domain in Resend
- Use a custom "from" address
- Check spam folder

---

## Free Tier Limits

Resend free tier includes:
- ✅ 3,000 emails/month
- ✅ 100 emails/day
- ✅ Perfect for testing and small apps

---

## Next Steps

Once you add the API key:
1. ✅ Notifications will automatically send when events happen
2. ✅ Users will receive emails based on their preferences
3. ✅ All notification types are ready to go!

**Just add the API key and you're done!** 🎉

