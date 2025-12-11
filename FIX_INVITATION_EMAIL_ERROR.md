# Fix Invitation Email Error 🔧

## Error Message
```
Invitation created but email failed. Code: EMP-XXXXX. Please share manually.
```

**Good news:** The invitation was created successfully! The code is: **EMP-XXXXX**

**Issue:** The email couldn't be sent. Let's fix it!

---

## Quick Fix Steps

### Step 1: Check Resend Configuration in Vercel

1. **Go to Vercel Dashboard:**
   - Visit [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click on your project

2. **Check Environment Variables:**
   - Go to **Settings** → **Environment Variables**
   - Look for these two variables:
     - `RESEND_API_KEY` ✅
     - `RESEND_FROM_EMAIL` ✅

3. **If Missing, Add Them:**
   
   **For RESEND_API_KEY:**
   - Go to [resend.com/api-keys](https://resend.com/api-keys)
   - Create a new API key (or use existing)
   - Copy the key (starts with `re_...`)
   - Add to Vercel: Name = `RESEND_API_KEY`, Value = your key
   - Check all environments (Production, Preview, Development)

   **For RESEND_FROM_EMAIL:**
   - If you have a verified domain: `noreply@yourdomain.com`
   - For testing: `onboarding@resend.dev` (works without verification)
   - Add to Vercel: Name = `RESEND_FROM_EMAIL`, Value = your email
   - Check all environments

### Step 2: Redeploy (IMPORTANT!)

After adding/updating environment variables:

1. Go to **Deployments** tab
2. Click the three dots (⋯) on the latest deployment
3. Click **"Redeploy"**
4. Wait 1-2 minutes

**Why?** Environment variables only load during deployment!

---

## Common Issues & Solutions

### Issue 1: "Email service not configured"
**Solution:**
- Add `RESEND_API_KEY` to Vercel
- Redeploy after adding

### Issue 2: "Invalid sender email"
**Solution:**
- Add `RESEND_FROM_EMAIL` to Vercel
- Use `onboarding@resend.dev` for testing
- Or verify your domain in Resend first

### Issue 3: "Domain not verified"
**Solution:**
- Go to [resend.com/domains](https://resend.com/domains)
- Add your domain
- Add DNS records (SPF, DKIM)
- Wait for verification
- Then use `noreply@yourdomain.com`

### Issue 4: "Rate limit reached"
**Solution:**
- Free tier has limits
- Wait a few minutes and try again
- Or upgrade Resend plan

---

## Test Email Sending

After fixing configuration:

1. **Go to Settings page** in your app
2. **Click "Send Test Email"**
3. **Check your inbox**
4. If test email works, invitations will work too!

---

## Manual Invitation (Temporary Solution)

While fixing email, you can share invitations manually:

1. **The invitation code is shown** in the error message
2. **Copy the code** (e.g., `EMP-4A242772B`)
3. **Share it with the employee** via:
   - Text message
   - WhatsApp
   - Phone call
   - Other messaging app

4. **Employee uses the code:**
   - They register at your app
   - Go to account setup
   - Enter the invitation code
   - They're added to your company!

---

## Checklist

- [ ] `RESEND_API_KEY` is set in Vercel
- [ ] `RESEND_FROM_EMAIL` is set in Vercel
- [ ] Both are set for all environments (Production, Preview, Development)
- [ ] App has been **redeployed** after adding variables
- [ ] Test email works (Settings → Send Test Email)
- [ ] Try sending invitation again

---

## Still Not Working?

1. **Check Vercel Logs:**
   - Go to **Deployments** → Latest deployment → **Logs**
   - Look for `[INVITATION EMAIL ERROR]` messages
   - This shows the exact error

2. **Check Resend Dashboard:**
   - Go to [resend.com/emails](https://resend.com/emails)
   - See if emails are being sent
   - Check for error messages

3. **Verify API Key:**
   - Make sure the key is correct (no extra spaces)
   - Make sure it's active in Resend dashboard

---

## ✅ Summary

**The invitation code is created successfully!** You can:
- ✅ Share it manually with the employee (works immediately)
- ✅ Fix email configuration to send automatically

**To fix email:**
1. Add `RESEND_API_KEY` to Vercel
2. Add `RESEND_FROM_EMAIL` to Vercel  
3. **Redeploy** (very important!)
4. Test again

The invitation code will work either way! 🎉
