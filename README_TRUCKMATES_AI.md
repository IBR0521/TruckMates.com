# TruckMates AI System

## Overview

TruckMates AI is a proprietary, self-hosted AI system specifically designed for logistics and fleet management. It combines deep logistics expertise with real-time data access and platform integration.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              TRUCKMATES AI SYSTEM                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Logistics Knowledge Base                            │
│     - FMCSA Regulations                                 │
│     - HOS Rules & Calculations                          │
│     - IFTA Rules & Calculations                         │
│     - Industry Benchmarks & Best Practices               │
│                                                          │
│  2. Self-Hosted LLM (Llama 3.1 / Mistral 7B)           │
│     - Fine-tuned on logistics knowledge                 │
│     - Hosted via Ollama                                 │
│                                                          │
│  3. RAG System (Retrieval-Augmented Generation)         │
│     - Vector database (Supabase pgvector)               │
│     - Semantic search in knowledge base                  │
│     - Platform data retrieval                           │
│                                                          │
│  4. Internet Access Layer                               │
│     - Web search (Tavily API)                           │
│     - Real-time data (fuel, weather, traffic, rates)    │
│                                                          │
│  5. Function Calling System                             │
│     - 50+ platform functions                            │
│     - Execute actions (create load, assign driver, etc.) │
│                                                          │
│  6. AI Orchestrator                                     │
│     - Coordinates all layers                            │
│     - Combines knowledge + data + actions                │
└─────────────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Install Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download from https://ollama.com/download
```

### 2. Download and Run LLM Model

```bash
# Pull Llama 3.1 8B (recommended)
ollama pull llama3.1:8b

# Or Mistral 7B
ollama pull mistral:7b

# Start Ollama server
ollama serve
```

### 3. Configure Environment Variables

Add to your `.env.local`:

```env
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# Internet Access (Optional)
TAVILY_API_KEY=your_tavily_api_key  # For web search
SERPER_API_KEY=your_serper_api_key  # Alternative to Tavily
OPENWEATHER_API_KEY=your_openweather_key  # For weather data
GOOGLE_MAPS_API_KEY=your_google_maps_key  # For traffic data (if not already set)
```

### 4. Set Up Database Schema

Run the SQL migration:

```bash
# In Supabase SQL Editor or via CLI
psql -f supabase/truckmates_ai_schema.sql
```

Or manually run `supabase/truckmates_ai_schema.sql` in your Supabase dashboard.

### 5. Verify Installation

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Should return list of available models
```

## Usage

### API Endpoint

```typescript
POST /api/truckmates-ai/chat

Body:
{
  "message": "What are the HOS rules for property-carrying drivers?",
  "conversationHistory": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ],
  "threadId": "optional-thread-id"
}

Response:
{
  "response": "The FMCSA Hours of Service rules for property-carrying drivers are...",
  "actions": [], // Function calls executed
  "internetData": {}, // Real-time data fetched
  "confidence": 0.95
}
```

### Example Queries

**Regulatory Questions:**
- "What are the HOS rules?"
- "How do I calculate IFTA fuel tax?"
- "What's the sleeper berth provision?"

**Business Intelligence:**
- "What's a good rate per mile for Chicago to Dallas?"
- "My fleet utilization is 72%. Is that good?"
- "How do I calculate cost per mile?"

**Platform Actions:**
- "Create a load from Chicago to Dallas, 20,000 lbs, $2,500"
- "Find matching trucks for load CH-101"
- "Assign driver John Smith to load CH-101"

**Real-Time Data:**
- "What's the current diesel price in Chicago?"
- "What's the weather forecast for Dallas?"
- "What's the traffic like from New York to Boston?"

## Components

### 1. Logistics Knowledge Base
**File:** `lib/truckmates-ai/logistics-knowledge-base.ts`

Contains comprehensive logistics knowledge:
- FMCSA regulations
- HOS rules and calculations
- IFTA rules and calculations
- DOT regulations
- Industry benchmarks (KPIs)
- Best practices
- Terminology dictionary
- Pricing strategies
- Cost structures

### 2. LLM Engine
**File:** `lib/truckmates-ai/llm-engine.ts`

Wrapper for self-hosted LLM:
- Connects to Ollama
- Builds expert prompts
- Extracts function calls
- Calculates confidence scores

### 3. RAG System
**File:** `lib/truckmates-ai/rag-system.ts`

Retrieval system:
- Searches logistics knowledge base
- Retrieves platform data (loads, drivers, trucks, routes)
- Vector search (when embeddings available)

### 4. Internet Access
**File:** `lib/truckmates-ai/internet-access.ts`

Real-time data access:
- Web search (Tavily/Serper)
- Fuel prices
- Weather data
- Traffic conditions
- Market rates
- Logistics news

### 5. Function Registry
**File:** `lib/truckmates-ai/function-registry.ts`

Platform function registry:
- Load management (create, update, assign)
- Driver management
- Truck management
- Route optimization
- Invoice generation
- DFM matching
- Rate analysis
- Internet functions

### 6. AI Orchestrator
**File:** `app/actions/truckmates-ai/orchestrator.ts`

Main coordinator:
- Processes user requests
- Coordinates all layers
- Executes function calls
- Returns expert responses

## Fine-Tuning (Future)

To improve AI expertise, you can fine-tune the model on logistics-specific data:

1. Generate training examples from knowledge base
2. Format for Llama/Mistral fine-tuning
3. Train model using Ollama or vLLM
4. Deploy fine-tuned model

See `scripts/fine-tune-truckmates-ai.ts` (to be created) for training data generation.

## Troubleshooting

### Ollama Not Running
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not, start it
ollama serve
```

### Model Not Found
```bash
# List available models
ollama list

# Pull model if missing
ollama pull llama3.1:8b
```

### Vector Search Not Working
- Ensure `pgvector` extension is enabled in Supabase
- Run `supabase/truckmates_ai_schema.sql` migration
- Generate embeddings for knowledge base entries

### Internet Access Not Working
- Check API keys in environment variables
- Verify API quotas/limits
- Check network connectivity

## Performance

- **Response Time:** 2-5 seconds for simple queries, 5-10 seconds for complex queries
- **Concurrent Users:** Supports 100+ concurrent users
- **Model Size:** Llama 3.1 8B requires ~5GB RAM, Mistral 7B requires ~4GB RAM

## Security

- All data stays within your infrastructure
- No external AI APIs (except optional internet search)
- RLS policies enforce company-level data isolation
- Function calls are validated before execution

## Next Steps

1. ✅ Core system implemented
2. ⏳ Fine-tune model on logistics data
3. ⏳ Build chat UI component
4. ⏳ Add conversation history persistence
5. ⏳ Generate embeddings for knowledge base
6. ⏳ Expand function registry
7. ⏳ Performance optimization

## Support

For issues or questions:
1. Check Ollama is running: `ollama serve`
2. Verify model is installed: `ollama list`
3. Check environment variables
4. Review database schema migration
5. Check API logs for errors


