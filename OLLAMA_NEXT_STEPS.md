# 🎯 Ollama Downloaded - Next Steps

Great! You've downloaded Ollama. Now let's get it running and connected to TruckMates AI.

## Step-by-Step Setup

### Step 1: Start Ollama Server

Open Terminal (Mac) or Command Prompt (Windows) and run:

```bash
ollama serve
```

**What this does:** Starts the Ollama server on `localhost:11434`

**Keep this terminal open** - Ollama needs to keep running in the background.

**✅ Success indicator:** You should see something like:
```
2024/01/01 12:00:00 routes.go:1008: INFO server config env="map[OLLAMA_HOST:0.0.0.0:11434]"
2024/01/01 12:00:00 routes.go:1016: INFO starting server...
```

### Step 2: Download the AI Model

Open a **NEW terminal window** (keep the first one running) and run:

```bash
ollama pull llama3.1:8b
```

**What this does:** Downloads the Llama 3.1 8B model (~5GB)

**⏱️ Time:** This takes 5-15 minutes depending on your internet speed

**✅ Success indicator:** You'll see progress like:
```
pulling manifest
pulling 8b176fa... 100% ▕████████████████▏ 4.7 GB                         
pulling 8b176fa... 100% ▕████████████████▏ 4.7 GB                         
verifying sha256 digest
writing manifest
success
```

### Step 3: Verify Installation

Test that everything works:

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Should return JSON with your models
```

**Expected output:**
```json
{
  "models": [
    {
      "name": "llama3.1:8b",
      "size": 4720000000,
      ...
    }
  ]
}
```

### Step 4: Configure TruckMates AI

Add these to your `.env.local` file (in the project root):

```env
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

**Where is `.env.local`?**
- In your project root: `/Users/ibrohimrahmat/Desktop/logistics-saa-s-design (1)/.env.local`
- If it doesn't exist, create it

### Step 5: Run Database Migration

1. Open your Supabase dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `supabase/truckmates_ai_schema.sql`
4. Click "Run"

**Or via CLI:**
```bash
# If you have Supabase CLI
supabase db push
```

### Step 6: Test TruckMates AI

```bash
# Run the test script
npx tsx scripts/test-truckmates-ai.ts
```

**✅ Success:** You should see test results showing the AI is working!

### Step 7: Access AI Chat

1. Start your Next.js app (if not running):
   ```bash
   npm run dev
   ```

2. Navigate to: `http://localhost:3000/dashboard/ai`

3. Start chatting with TruckMates AI! 🎉

## Quick Setup Script

I've created a setup script to automate most of this:

```bash
# Run the setup script
./scripts/setup-ollama.sh
```

This script will:
- ✅ Check if Ollama is installed
- ✅ Start Ollama server
- ✅ Download the model (if not already downloaded)
- ✅ Test the connection
- ✅ Show you next steps

## Troubleshooting

### "Connection refused" Error

**Problem:** TruckMates AI can't connect to Ollama

**Solution:**
1. Make sure Ollama is running: `ollama serve`
2. Check the port: `curl http://localhost:11434/api/tags`
3. Verify `.env.local` has correct URL

### "Model not found" Error

**Problem:** Model isn't downloaded

**Solution:**
```bash
# Download the model
ollama pull llama3.1:8b

# Or use smaller model
ollama pull mistral:7b
```

### Ollama Keeps Stopping

**Problem:** Ollama server stops when you close terminal

**Solution (macOS):**
```bash
# Install as a service (using Homebrew)
brew services start ollama
```

**Solution (Linux):**
```bash
# Install as a service
sudo systemctl enable ollama
sudo systemctl start ollama
```

**Solution (Windows):**
- Ollama should run as a service automatically
- Check Windows Services if needed

## What's Happening?

Here's the flow:

```
You type in TruckMates AI chat
    ↓
TruckMates AI sends request to Ollama
    ↓
Ollama (localhost:11434) processes with llama3.1:8b
    ↓
Ollama returns AI response
    ↓
TruckMates AI shows you the answer
```

## Checklist

- [ ] Ollama server is running (`ollama serve`)
- [ ] Model is downloaded (`ollama pull llama3.1:8b`)
- [ ] Verified connection (`curl http://localhost:11434/api/tags`)
- [ ] Added to `.env.local` (OLLAMA_BASE_URL and OLLAMA_MODEL)
- [ ] Ran database migration (`supabase/truckmates_ai_schema.sql`)
- [ ] Tested TruckMates AI (`npx tsx scripts/test-truckmates-ai.ts`)
- [ ] Accessed AI chat (`/dashboard/ai`)

## Need Help?

If you get stuck:
1. Check `OLLAMA_INSTALLATION_GUIDE.md` for detailed troubleshooting
2. Verify Ollama is running: `curl http://localhost:11434/api/tags`
3. Check browser console for errors
4. Make sure `.env.local` is configured correctly

## You're Almost There! 🚀

Once Ollama is running and the model is downloaded, TruckMates AI will be fully functional!

