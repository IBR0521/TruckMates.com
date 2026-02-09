#!/bin/bash

# TruckMates AI - Quick Start Script
# This script helps you get TruckMates AI running quickly

echo "🚀 TruckMates AI - Quick Start"
echo "==============================="
echo ""

# Check if Ollama is running
echo "1️⃣  Checking Ollama server..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "   ✅ Ollama is running"
else
    echo "   ❌ Ollama is not running"
    echo ""
    echo "   Please start Ollama in a separate terminal:"
    echo "   $ ollama serve"
    echo ""
    echo "   Then run this script again."
    exit 1
fi

# Check if model exists
echo ""
echo "2️⃣  Checking AI model..."
MODEL_EXISTS=$(ollama list 2>/dev/null | grep -c "llama3.1:8b\|mistral:7b" || echo "0")
if [ "$MODEL_EXISTS" -gt 0 ]; then
    echo "   ✅ AI model is ready"
    ollama list | grep -E "llama3.1:8b|mistral:7b"
else
    echo "   ❌ AI model not found"
    echo "   Please download: ollama pull llama3.1:8b"
    exit 1
fi

# Check environment variables
echo ""
echo "3️⃣  Checking environment variables..."
if grep -q "OLLAMA_BASE_URL" .env.local 2>/dev/null; then
    echo "   ✅ Environment variables configured"
else
    echo "   ⚠️  Adding Ollama config to .env.local..."
    echo "" >> .env.local
    echo "# TruckMates AI - Ollama Configuration" >> .env.local
    echo "OLLAMA_BASE_URL=http://localhost:11434" >> .env.local
    echo "OLLAMA_MODEL=llama3.1:8b" >> .env.local
    echo "   ✅ Added to .env.local"
fi

# Check database
echo ""
echo "4️⃣  Database migration..."
echo "   ⚠️  Manual step required:"
echo "   1. Open Supabase Dashboard"
echo "   2. Go to SQL Editor"
echo "   3. Run: supabase/truckmates_ai_schema.sql"
echo ""

# Summary
echo "==============================="
echo "✅ Setup Status:"
echo "==============================="
echo "   Ollama: ✅ Running"
echo "   Model: ✅ Ready"
echo "   Environment: ✅ Configured"
echo "   Database: ⚠️  Needs migration"
echo ""
echo "📝 Next Steps:"
echo "   1. Run database migration in Supabase"
echo "   2. Restart dev server: npm run dev"
echo "   3. Access: http://localhost:3000/dashboard/ai"
echo ""
echo "🎉 You're ready to use TruckMates AI!"

