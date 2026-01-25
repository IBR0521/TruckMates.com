#!/bin/bash

echo "🔍 Checking TruckMates Platform Setup..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules not found"
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local not found"
    echo "📝 Creating .env.local from template..."
    if [ -f "env.example" ]; then
        cp env.example .env.local
        echo "✅ Created .env.local"
        echo "⚠️  IMPORTANT: Edit .env.local and add your Supabase credentials!"
        echo "   You need:"
        echo "   - NEXT_PUBLIC_SUPABASE_URL"
        echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
        echo ""
    else
        echo "❌ env.example not found"
    fi
else
    echo "✅ .env.local exists"
    # Check if it has the required variables
    if ! grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local || grep -q "your-project-id" .env.local; then
        echo "⚠️  .env.local exists but may need configuration"
        echo "   Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set"
    else
        echo "✅ .env.local appears to be configured"
    fi
    echo ""
fi

# Check if port 3000 is in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 3000 is already in use"
    echo "   Killing existing process..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    sleep 2
fi

echo "🚀 Starting development server..."
echo "   The server will be available at: http://localhost:3000"
echo ""
echo "   If you see connection errors, check:"
echo "   1. Your .env.local file has correct Supabase credentials"
echo "   2. Your internet connection is working"
echo "   3. Your Supabase project is active"
echo ""

npm run dev


