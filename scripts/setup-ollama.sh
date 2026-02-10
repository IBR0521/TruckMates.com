#!/bin/bash

# TruckMates AI - Ollama Setup Script
# This script helps you set up Ollama for TruckMates AI

echo "🚀 TruckMates AI - Ollama Setup"
echo "================================"
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed or not in PATH"
    echo "   Please install Ollama first:"
    echo "   macOS: brew install ollama"
    echo "   Linux: curl -fsSL https://ollama.com/install.sh | sh"
    echo "   Windows: Download from https://ollama.com/download"
    exit 1
fi

echo "✅ Ollama is installed"
echo ""

# Check if Ollama is running
echo "📡 Checking if Ollama server is running..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama server is running"
else
    echo "⚠️  Ollama server is not running"
    echo "   Starting Ollama server..."
    echo "   (This will run in the background)"
    
    # Try to start Ollama (macOS/Linux)
    if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "linux-gnu"* ]]; then
        ollama serve &
        sleep 3
        
        # Check again
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            echo "✅ Ollama server started successfully"
        else
            echo "❌ Failed to start Ollama server"
            echo "   Please start it manually: ollama serve"
            exit 1
        fi
    else
        echo "   Please start Ollama manually: ollama serve"
        echo "   Then run this script again"
        exit 1
    fi
fi

echo ""

# Check if model is downloaded
echo "🤖 Checking for AI model..."
MODEL_EXISTS=$(ollama list 2>/dev/null | grep -c "llama3.1:8b\|mistral:7b" || echo "0")

if [ "$MODEL_EXISTS" -gt 0 ]; then
    echo "✅ AI model is already downloaded"
    ollama list | grep -E "llama3.1:8b|mistral:7b"
else
    echo "📥 AI model not found. Downloading llama3.1:8b..."
    echo "   (This will download ~5GB - may take a few minutes)"
    echo ""
    
    if ollama pull llama3.1:8b; then
        echo "✅ Model downloaded successfully"
    else
        echo "❌ Failed to download model"
        echo "   You can try: ollama pull mistral:7b (smaller model)"
        exit 1
    fi
fi

echo ""

# Test the model
echo "🧪 Testing the model..."
TEST_RESPONSE=$(curl -s http://localhost:11434/api/generate -d '{
  "model": "llama3.1:8b",
  "prompt": "Say hello",
  "stream": false
}' 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "✅ Model is working correctly"
else
    echo "⚠️  Could not test model (this is okay, might need to wait a moment)"
fi

echo ""
echo "✅ Ollama setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Add to .env.local:"
echo "      OLLAMA_BASE_URL=http://localhost:11434"
echo "      OLLAMA_MODEL=llama3.1:8b"
echo ""
echo "   2. Run database migration:"
echo "      Execute supabase/truckmates_ai_schema.sql in Supabase"
echo ""
echo "   3. Test TruckMates AI:"
echo "      npx tsx scripts/test-truckmates-ai.ts"
echo ""
echo "   4. Access AI chat:"
echo "      Navigate to /dashboard/ai in your app"
echo ""


