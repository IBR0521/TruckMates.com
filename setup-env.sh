#!/bin/bash

# Supabase Environment Variables Setup Script
# This script helps you set up your .env.local file

echo "🔧 Setting up Supabase environment variables..."
echo ""

# Check if .env.local already exists
if [ -f ".env.local" ]; then
    echo "⚠️  .env.local already exists"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Aborted. Existing .env.local preserved."
        exit 1
    fi
    echo "📝 Backing up existing .env.local to .env.local.backup"
    cp .env.local .env.local.backup
fi

# Create .env.local with Supabase credentials
cat > .env.local << 'EOF'
# Supabase Configuration (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://ozzcdefgnutcotcgqruf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96emNkZWZnbnV0Y290Y2dxcnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDU0MTIsImV4cCI6MjA4NjM4MTQxMn0.27PGSSPQaLjdKoKvMwIMBLlyO_jvTHSCNRYg1w8eUwo

# Optional: Service Role Key (only use in server-side code, never expose to client)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96emNkZWZnbnV0Y290Y2dxcnVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgwNTQxMiwiZXhwIjoyMDg2MzgxNDEyfQ.g0z5t6hSIPqKxXpUVPx0P33mCqzy1fAINrNDBVUkrmw

# App URL (for redirects and OAuth callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ============================================
# API KEYS FOR FULL FEATURE FUNCTIONALITY
# ============================================

# Google Maps API (REQUIRED for Route Optimization)
# Get from: https://console.cloud.google.com/
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Google Gemini API (REQUIRED for Document AI Analysis)
# Get from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# Resend Email Service (REQUIRED for Email Notifications)
# Get from: https://resend.com/api-keys
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
ADMIN_EMAIL=your-email@gmail.com

# Twilio SMS Service (OPTIONAL - for SMS Notifications)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Stripe Payment Processing (OPTIONAL - for Invoice Payments)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# PayPal Payment Processing (OPTIONAL - for Invoice Payments)
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox

# QuickBooks Integration (OPTIONAL - for Accounting Sync)
QUICKBOOKS_CLIENT_ID=your_quickbooks_client_id
QUICKBOOKS_CLIENT_SECRET=your_quickbooks_client_secret
QUICKBOOKS_REDIRECT_URI=https://your-domain.com/api/quickbooks/callback

# Sentry Error Tracking (OPTIONAL but recommended)
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
NEXT_PUBLIC_SENTRY_DEBUG=false
EOF

echo "✅ Created .env.local file with Supabase credentials"
echo ""
echo "📋 Next steps:"
echo "   1. Restart your development server: npm run dev"
echo "   2. Visit http://localhost:3000/diagnostics to verify connection"
echo "   3. For production, add these variables to Vercel:"
echo "      - NEXT_PUBLIC_SUPABASE_URL"
echo "      - NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "   4. Redeploy your Vercel project"
echo ""
echo "🔒 Security reminder: .env.local is in .gitignore and won't be committed"
echo ""

