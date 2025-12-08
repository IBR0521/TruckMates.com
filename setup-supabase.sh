#!/bin/bash

echo "🚀 Supabase Setup Helper"
echo "========================"
echo ""

# Check if .env.local exists
if [ -f ".env.local" ]; then
    echo "✅ .env.local file exists"
    echo ""
    echo "Current contents:"
    cat .env.local
    echo ""
    echo "⚠️  If you need to update it, edit .env.local manually"
else
    echo "📝 Creating .env.local file..."
    cat > .env.local << 'ENVFILE'
# Supabase Configuration
# Get these from: https://supabase.com/dashboard → Settings → API

NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

ENVFILE
    echo "✅ Created .env.local"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env.local and add your Supabase keys!"
    echo "   1. Go to https://supabase.com/dashboard"
    echo "   2. Select your project"
    echo "   3. Go to Settings → API"
    echo "   4. Copy Project URL and anon public key"
    echo "   5. Paste them in .env.local"
fi

echo ""
echo "📦 Checking Supabase packages..."
if npm list @supabase/supabase-js @supabase/ssr > /dev/null 2>&1; then
    echo "✅ Supabase packages are installed"
else
    echo "📥 Installing Supabase packages..."
    npm install @supabase/supabase-js @supabase/ssr
    echo "✅ Packages installed"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your Supabase keys"
echo "2. Go to Supabase Dashboard → SQL Editor"
echo "3. Copy code from supabase/schema.sql"
echo "4. Paste and run in Supabase SQL Editor"
echo "5. Restart your dev server: npm run dev"
echo ""
