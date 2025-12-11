# Fix OpenAI Authentication Error 🔧

## Error Message
```
OpenAI API authentication failed. Please check that OPENAI_API_KEY is correctly set in your environment variables.
```

This means OpenAI is **rejecting** your API key. Let's fix it!

---

## Step 1: Verify API Key in Vercel

1. **Go to Vercel Dashboard:**
   - Visit [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click on your project

2. **Check Environment Variables:**
   - Go to **Settings** → **Environment Variables**
   - Look for `OPENAI_API_KEY`
   - **Click on it** to see the value (it will be masked)

3. **Verify the Key:**
   - Make sure it starts with `sk-proj-` or `sk-`
   - Make sure there are **NO extra spaces** before or after
   - Make sure it's the **full key** (should be very long)

---

## Step 2: Check All Environments

Make sure the key is set for **ALL environments**:

- ✅ **Production**
- ✅ **Preview**  
- ✅ **Development**

**How to check:**
1. In Environment Variables, click on `OPENAI_API_KEY`
2. Look at the "Environments" column
3. All three should be checked ✅

**If not:**
1. Click **Edit** on the variable
2. Check all three environments
3. Click **Save**

---

## Step 3: Verify Your OpenAI API Key

1. **Go to OpenAI Platform:**
   - Visit [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Sign in to your account

2. **Check Your Keys:**
   - Look for the key you're using
   - Make sure it's **Active** (not revoked)
   - If it's revoked, create a new one

3. **Create New Key (if needed):**
   - Click **"Create new secret key"**
   - Name it: `TruckMates Production`
   - **COPY THE KEY** (you won't see it again!)
   - Update it in Vercel

---

## Step 4: Update API Key in Vercel

1. **In Vercel Dashboard:**
   - Go to **Settings** → **Environment Variables**
   - Find `OPENAI_API_KEY`
   - Click **Edit** (or delete and recreate)

2. **Enter the Key:**
   - **Name**: `OPENAI_API_KEY` (exactly this, no spaces)
   - **Value**: Paste your API key (no spaces before/after)
   - **Environments**: Check all three ✅
   - Click **Save**

3. **Important:** Make sure there are:
   - ❌ NO spaces at the beginning
   - ❌ NO spaces at the end
   - ❌ NO line breaks
   - ✅ Just the key itself

---

## Step 5: Redeploy Your App

**CRITICAL:** After updating the environment variable, you **MUST redeploy**:

1. **Go to Deployments tab**
2. **Click the three dots (⋯)** on the latest deployment
3. **Click "Redeploy"**
4. **Wait 1-2 minutes** for deployment to complete

**OR** trigger a new deployment by:
- Pushing a small change to your repo
- Or wait for the next automatic deployment

---

## Step 6: Test Again

After redeploying:

1. Go to your app
2. Navigate to **Upload & Analyze Document**
3. Upload a test document
4. It should work now! ✅

---

## Common Issues & Solutions

### Issue 1: "Key not found"
**Solution:** Make sure the variable name is exactly `OPENAI_API_KEY` (case-sensitive)

### Issue 2: "Invalid API key"
**Solution:** 
- Check the key in OpenAI dashboard
- Make sure it's active
- Create a new key if needed

### Issue 3: "Still not working after redeploy"
**Solution:**
- Wait 2-3 minutes (deployment might still be processing)
- Check Vercel logs: **Deployments** → Click deployment → **Logs**
- Look for any errors about environment variables

### Issue 4: "Key works locally but not in production"
**Solution:**
- Make sure the key is set for **Production** environment in Vercel
- Not just Preview or Development

---

## Verify It's Working

After fixing, you should see:
- ✅ Document uploads successfully
- ✅ "Analyzing document..." message appears
- ✅ Data is extracted and shown
- ✅ No authentication errors

---

## Still Not Working?

If you've tried everything and it's still not working:

1. **Check Vercel Logs:**
   - Go to **Deployments** → Latest deployment → **Logs**
   - Look for `[DOCUMENT_ANALYSIS]` messages
   - This will show the actual error

2. **Test the API Key:**
   - Use a tool like Postman or curl to test the key directly
   - Or check OpenAI dashboard for usage/errors

3. **Create a Fresh Key:**
   - Sometimes keys get corrupted
   - Create a new one in OpenAI
   - Update it in Vercel
   - Redeploy

---

## Quick Checklist

- [ ] API key is set in Vercel
- [ ] Key is set for ALL environments (Production, Preview, Development)
- [ ] Key has no extra spaces
- [ ] Key is active in OpenAI dashboard
- [ ] App has been redeployed after adding/updating the key
- [ ] Waited 2-3 minutes after redeploy
- [ ] Tested the document upload again

---

## ✅ Summary

The authentication error means OpenAI is rejecting your API key. Follow these steps:

1. ✅ Verify key in Vercel (no spaces, correct format)
2. ✅ Check all environments are selected
3. ✅ Verify key is active in OpenAI
4. ✅ Update key if needed
5. ✅ **Redeploy** (very important!)
6. ✅ Test again

**Most common issue:** Forgetting to redeploy after adding/updating the environment variable!
