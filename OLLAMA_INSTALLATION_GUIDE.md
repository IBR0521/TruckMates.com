# Ollama Installation Guide for TruckMates AI

## What is Ollama?

**Ollama** is a tool that lets you run large language models (LLMs) **locally on your computer or server**. Instead of using external AI APIs (like OpenAI), Ollama runs the AI model directly on your machine.

Think of it like this:
- **OpenAI/ChatGPT**: You send requests to their servers (requires internet, costs money per request)
- **Ollama**: The AI model runs on YOUR computer/server (no internet needed after download, free to use)

## Where Should Ollama Be Installed?

### Option 1: Local Development (Your Computer) ✅ Recommended for Testing

**Install on:** Your local machine (Mac, Windows, or Linux)

**When to use:**
- Testing and development
- Running the app locally (`npm run dev`)
- Learning how the AI works

**How it works:**
```
Your Computer
├── Next.js App (localhost:3000)
└── Ollama Server (localhost:11434)
    └── LLM Model (llama3.1:8b)
```

### Option 2: Production Server (Same Server as Your App) ✅ Recommended for Production

**Install on:** The same server where your Next.js app runs (Vercel, AWS, DigitalOcean, etc.)

**When to use:**
- Production deployment
- When your app is live
- When users are accessing the platform

**How it works:**
```
Production Server
├── Next.js App (your-domain.com)
└── Ollama Server (localhost:11434 or separate port)
    └── LLM Model (llama3.1:8b)
```

### Option 3: Separate AI Server (Advanced) ⚙️ For Large Scale

**Install on:** A dedicated server separate from your app

**When to use:**
- High traffic applications
- Need to scale AI separately
- Multiple apps using the same AI

**How it works:**
```
App Server (Vercel/AWS)
└── Connects to → AI Server (separate machine)
    └── Ollama Server (ai.your-domain.com:11434)
        └── LLM Model
```

## Installation Instructions

### macOS Installation

```bash
# Method 1: Using Homebrew (Recommended)
brew install ollama

# Method 2: Direct Download
# Visit: https://ollama.com/download
# Download the macOS installer (.dmg file)
# Double-click to install
```

**After installation:**
```bash
# Start Ollama (it runs in the background)
ollama serve

# Verify it's running
curl http://localhost:11434/api/tags
```

### Windows Installation

1. **Download:**
   - Visit: https://ollama.com/download
   - Download the Windows installer (.exe file)

2. **Install:**
   - Double-click the installer
   - Follow the installation wizard
   - Ollama will start automatically

3. **Verify:**
   - Open Command Prompt or PowerShell
   - Run: `curl http://localhost:11434/api/tags`
   - Should return JSON with available models

### Linux Installation

```bash
# Install using the official script
curl -fsSL https://ollama.com/install.sh | sh

# Or using package manager (Ubuntu/Debian)
# Note: Check Ollama website for latest instructions
```

**After installation:**
```bash
# Start Ollama service
sudo systemctl start ollama

# Or run manually
ollama serve

# Verify it's running
curl http://localhost:11434/api/tags
```

## Downloading the AI Model

After installing Ollama, you need to download the language model:

```bash
# Download Llama 3.1 8B (Recommended - ~5GB)
ollama pull llama3.1:8b

# Or Mistral 7B (Alternative - ~4GB)
ollama pull mistral:7b

# Verify model is downloaded
ollama list
```

**What this does:**
- Downloads the AI model to your computer (~5GB for Llama 3.1 8B)
- Stores it locally (no need to download again)
- Makes it available for TruckMates AI to use

## System Requirements

### Minimum Requirements:
- **RAM:** 8GB (16GB recommended)
- **Storage:** 10GB free space (for model)
- **CPU:** Any modern processor (faster = better responses)

### Recommended:
- **RAM:** 16GB+
- **Storage:** 20GB+ free space
- **CPU:** Multi-core processor
- **GPU:** Optional but recommended (NVIDIA GPU with CUDA support)

## How TruckMates AI Connects to Ollama

### Configuration

In your `.env.local` file:

```env
# Local Development (Ollama on same machine)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# Production (Ollama on same server)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# Production (Ollama on separate server)
OLLAMA_BASE_URL=http://ai-server.your-domain.com:11434
OLLAMA_MODEL=llama3.1:8b
```

### How It Works

```
User asks question in TruckMates AI
    ↓
TruckMates AI Orchestrator
    ↓
LLM Engine (lib/truckmates-ai/llm-engine.ts)
    ↓
HTTP Request to Ollama
    ↓
Ollama Server (localhost:11434)
    ↓
LLM Model (llama3.1:8b)
    ↓
Response back to TruckMates AI
    ↓
User sees answer
```

## Testing Installation

### Step 1: Check Ollama is Running

```bash
# Should return list of models
curl http://localhost:11434/api/tags
```

**Expected response:**
```json
{
  "models": [
    {
      "name": "llama3.1:8b",
      "size": 4720000000,
      "digest": "..."
    }
  ]
}
```

### Step 2: Test Model Directly

```bash
# Test the model directly
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.1:8b",
  "prompt": "What is logistics?",
  "stream": false
}'
```

### Step 3: Test TruckMates AI

```bash
# Run the test script
npx tsx scripts/test-truckmates-ai.ts
```

## Production Deployment

### Option A: Same Server (Vercel/Serverless)

**Challenge:** Vercel is serverless, Ollama needs a persistent server.

**Solution:** Use a separate server for Ollama:

1. **Deploy Ollama on a VPS:**
   - DigitalOcean Droplet
   - AWS EC2 instance
   - Google Cloud Compute Engine

2. **Configure environment:**
   ```env
   OLLAMA_BASE_URL=http://your-ai-server-ip:11434
   ```

3. **Security:** Use firewall rules to restrict access

### Option B: Docker Container

```bash
# Run Ollama in Docker
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama

# Pull model
docker exec -it ollama ollama pull llama3.1:8b
```

### Option C: Managed Service (Future)

Consider using managed Ollama services:
- **Ollama Cloud** (if available)
- **Self-hosted on dedicated server**

## Troubleshooting

### Ollama Not Starting

```bash
# Check if port 11434 is in use
lsof -i :11434

# Kill process if needed
kill -9 <PID>

# Restart Ollama
ollama serve
```

### Model Not Found

```bash
# List downloaded models
ollama list

# Pull model if missing
ollama pull llama3.1:8b

# Verify download
ollama show llama3.1:8b
```

### Connection Refused

**Error:** `Connection refused` or `ECONNREFUSED`

**Solution:**
1. Check Ollama is running: `curl http://localhost:11434/api/tags`
2. Check firewall settings
3. Verify `OLLAMA_BASE_URL` in `.env.local`
4. Try restarting Ollama: `ollama serve`

### Out of Memory

**Error:** Model fails to load or crashes

**Solution:**
- Use smaller model: `ollama pull mistral:7b` (smaller than llama3.1:8b)
- Close other applications
- Add more RAM to your system

## Quick Start Checklist

- [ ] Install Ollama on your machine
- [ ] Start Ollama server (`ollama serve`)
- [ ] Download model (`ollama pull llama3.1:8b`)
- [ ] Verify installation (`curl http://localhost:11434/api/tags`)
- [ ] Add to `.env.local`: `OLLAMA_BASE_URL=http://localhost:11434`
- [ ] Add to `.env.local`: `OLLAMA_MODEL=llama3.1:8b`
- [ ] Run database migration (`supabase/truckmates_ai_schema.sql`)
- [ ] Test TruckMates AI (`npx tsx scripts/test-truckmates-ai.ts`)
- [ ] Access AI chat at `/dashboard/ai`

## Summary

**Ollama = Local AI Server**

- **What:** Tool to run AI models on your computer
- **Where:** Install on the same machine as your app (for development) or on a server (for production)
- **Why:** Free, private, no API costs, full control
- **How:** Install → Download model → Start server → Connect TruckMates AI

**For Development:** Install on your Mac/Windows/Linux computer
**For Production:** Install on your production server or a dedicated AI server

That's it! Once Ollama is running, TruckMates AI will automatically connect to it and start working.

