# How to Add OpenAI API Key

## Step 1: Get Your OpenAI API Key

1. **Go to OpenAI Platform:**
   - Visit: https://platform.openai.com/api-keys
   - Sign up or log in with your OpenAI account

2. **Create a New API Key:**
   - Click **"Create new secret key"** button
   - Give it a name (e.g., "TruckMates Logistics")
   - Click **"Create secret key"**
   - **IMPORTANT:** Copy the key immediately - you won't be able to see it again!
   - It will look like: `sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

3. **Add Payment Method (if needed):**
   - OpenAI requires a payment method to use the API
   - Go to: https://platform.openai.com/account/billing
   - Add a credit card
   - Set up billing limits if desired

---

## Step 2: Add API Key to Local Development (.env.local)

### Option A: Using VS Code or Text Editor

1. **Open your project folder** in VS Code (or any text editor)

2. **Find or create `.env.local` file:**
   - Look in the root folder of your project (same level as `package.json`)
   - If it doesn't exist, create a new file named `.env.local`

3. **Add the API key:**
   ```env
   OPENAI_API_KEY=sk-proj-your-actual-api-key-here
   ```
   
   **Example:**
   ```env
   OPENAI_API_KEY=sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
   ```

4. **Save the file**

5. **Restart your development server:**
   - Stop the server (press `Ctrl+C` in terminal)
   - Start it again: `npm run dev` or `pnpm dev`

### Option B: Using Terminal (Mac/Linux)

1. **Open terminal in your project folder**

2. **Create or edit `.env.local`:**
   ```bash
   nano .env.local
   ```
   (or use `vim`, `code`, or any editor)

3. **Add the line:**
   ```env
   OPENAI_API_KEY=sk-proj-your-actual-api-key-here
   ```

4. **Save and exit:**
   - In nano: Press `Ctrl+X`, then `Y`, then `Enter`
   - In vim: Press `Esc`, type `:wq`, press `Enter`

5. **Restart your dev server**

### Option C: Using Terminal (Windows)

1. **Open Command Prompt or PowerShell in your project folder**

2. **Create the file:**
   ```cmd
   echo OPENAI_API_KEY=sk-proj-your-actual-api-key-here > .env.local
   ```
   
   Or edit it:
   ```cmd
   notepad .env.local
   ```

3. **Add the key and save**

4. **Restart your dev server**

---

## Step 3: Verify It's Working

1. **Check if the file exists:**
   ```bash
   # Mac/Linux
   cat .env.local
   
   # Windows
   type .env.local
   ```

2. **Make sure the key is there** (it should show `OPENAI_API_KEY=sk-proj-...`)

3. **Test the feature:**
   - Go to: `http://localhost:3000/dashboard/upload-document`
   - Upload a document image (JPG or PNG)
   - If it works, you'll see "Document analyzed successfully!"
   - If you see "OpenAI API key not configured", check your `.env.local` file

---

## Step 4: Add API Key to Production (Vercel)

If you're deploying to Vercel, you need to add the API key there too:

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Select your project

2. **Go to Settings:**
   - Click on your project
   - Click **"Settings"** tab
   - Click **"Environment Variables"** in the left sidebar

3. **Add the variable:**
   - **Key:** `OPENAI_API_KEY`
   - **Value:** `sk-proj-your-actual-api-key-here`
   - **Environment:** Select all (Production, Preview, Development)
   - Click **"Save"**

4. **Redeploy:**
   - Go to **"Deployments"** tab
   - Click the **"..."** menu on the latest deployment
   - Click **"Redeploy"**
   - Or push a new commit to trigger a new deployment

---

## Step 5: Security Best Practices

### ✅ DO:
- ✅ Keep your API key secret
- ✅ Never commit `.env.local` to git (it's already in `.gitignore`)
- ✅ Use different keys for development and production
- ✅ Set up billing limits in OpenAI dashboard
- ✅ Monitor your API usage

### ❌ DON'T:
- ❌ Share your API key publicly
- ❌ Commit it to GitHub
- ❌ Put it in client-side code
- ❌ Share it in screenshots or documentation

---

## Troubleshooting

### "OpenAI API key not configured" error

**Check:**
1. Is `.env.local` in the root folder? (same level as `package.json`)
2. Is the file named exactly `.env.local`? (not `.env.local.txt`)
3. Did you restart the dev server after adding the key?
4. Is there a typo in the key? (should start with `sk-proj-` or `sk-`)
5. Are there any spaces around the `=` sign? (should be `KEY=value`, not `KEY = value`)

### "Invalid API key" error

**Check:**
1. Did you copy the entire key? (it's very long)
2. Is the key still valid? (check OpenAI dashboard)
3. Do you have credits/billing set up in OpenAI?

### API key works locally but not in production

**Check:**
1. Did you add it to Vercel environment variables?
2. Did you redeploy after adding it?
3. Is it set for the correct environment (Production)?

---

## Example .env.local File

Your `.env.local` file should look something like this:

```env
# Supabase (you probably already have these)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# OpenAI (add this)
OPENAI_API_KEY=sk-proj-your-actual-api-key-here

# Other environment variables...
RESEND_API_KEY=your-resend-key-if-using
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Quick Checklist

- [ ] Got OpenAI API key from https://platform.openai.com/api-keys
- [ ] Added payment method to OpenAI account
- [ ] Created/edited `.env.local` file in project root
- [ ] Added `OPENAI_API_KEY=sk-proj-...` to `.env.local`
- [ ] Saved the file
- [ ] Restarted development server
- [ ] Tested upload document feature
- [ ] Added to Vercel (if deploying to production)
- [ ] Redeployed (if needed)

---

## Need Help?

If you're still having issues:
1. Check the browser console for errors
2. Check your terminal/command prompt for errors
3. Verify the `.env.local` file is in the correct location
4. Make sure you restarted the dev server
5. Check OpenAI dashboard to verify your API key is active
