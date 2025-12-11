# OpenAI API Setup for Document Analysis

## Quick Setup Guide

### Step 1: Get Your OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click **"Create new secret key"**
4. Name it: `TruckMates Document Analysis`
5. **COPY THE KEY** (starts with `sk-proj-...` or `sk-...`)
   - ⚠️ You won't see it again!

### Step 2: Add to Vercel (Production)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Click **"Add New"**
5. Fill in:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (paste the key you copied)
   - **Environments**: Check all three ✅
     - Production
     - Preview
     - Development
6. Click **"Save"**
7. **Redeploy** your app:
   - Go to **Deployments** tab
   - Click the three dots (⋯) on the latest deployment
   - Click **"Redeploy"**

### Step 3: Add to Local Development (Optional)

If you want to test locally:

1. Create `.env.local` file in your project root (if it doesn't exist)
2. Add this line:
   ```env
   OPENAI_API_KEY=sk-proj-your-actual-key-here
   ```
3. Save the file
4. **Restart your dev server** (stop and run `npm run dev` again)

---

## ⚠️ Important Notes

### Rate Limits
- **Free tier**: Limited requests per minute
- **Paid tier**: Higher limits based on your plan
- If you hit rate limits, you'll see: "Rate limit reached" error
- **Solution**: Add payment method at [OpenAI Billing](https://platform.openai.com/account/billing)

### Cost
- OpenAI charges per token used
- Document analysis uses GPT-4o-mini (cheaper model)
- Typical cost: $0.01-0.05 per document analysis
- Monitor usage at [OpenAI Usage](https://platform.openai.com/usage)

### Security
- **Never** commit API keys to git
- Always use environment variables
- Keep your keys secret

---

## ✅ Verification

After adding the key:

1. Go to your app → **Upload & Analyze Document**
2. Upload a test document
3. If it works, you'll see: "Document analyzed successfully!"
4. If you still see an error, check:
   - Key is correct (no extra spaces)
   - Key is added to all environments (Production, Preview, Development)
   - App has been redeployed after adding the key

---

## 🐛 Troubleshooting

### Error: "OpenAI API key not configured"
- **Fix**: Add `OPENAI_API_KEY` to Vercel environment variables
- **Then**: Redeploy your app

### Error: "Rate limit reached"
- **Fix**: Add payment method to your OpenAI account
- **Or**: Wait for the rate limit to reset (usually 1 hour)

### Error: "Invalid API key"
- **Fix**: Check that the key is correct (no typos)
- **Fix**: Make sure you copied the entire key
- **Fix**: Generate a new key if needed

### Document analysis not working
- **Check**: Is the key set in the correct environment?
- **Check**: Did you redeploy after adding the key?
- **Check**: Is your OpenAI account active?

---

## 📖 More Information

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [OpenAI Pricing](https://openai.com/pricing)
- [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits)
