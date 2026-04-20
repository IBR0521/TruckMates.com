#!/bin/bash

# Supabase Environment Variables Setup Script
# This script helps you set up your .env.local file (placeholders only — paste real values from Supabase / Vercel)

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

# Create .env.local — replace YOUR_* placeholders with values from Supabase Dashboard → API
cat > .env.local << 'EOF'
# Supabase Configuration (REQUIRED) — get from Supabase Dashboard → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_jwt_here

# Optional: Service Role Key (only use in server-side code, never expose to client)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_jwt_here

# App URL (for redirects and OAuth callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ============================================
# API KEYS FOR FULL FEATURE FUNCTIONALITY
# ============================================

# Google Maps API (REQUIRED for Route Optimization)
# Get from: https://console.cloud.google.com/
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

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

echo "✅ Created .env.local file with placeholder Supabase credentials — edit and paste real keys"
echo ""
echo "📋 Next steps:"
echo "   1. Edit .env.local with values from Supabase / Vercel"
echo "   2. Restart your development server: npm run dev"
echo "   3. Visit http://localhost:3000/diagnostics to verify connection"
echo "   4. For production, add these variables to Vercel and redeploy"
echo ""
echo "🔒 Security reminder: .env.local is in .gitignore and won't be committed"
echo ""

