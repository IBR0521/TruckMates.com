# API Keys Setup Guide - Complete Feature Activation

This guide lists all API keys and credentials needed to make **100% of features work**.

---

## ✅ **ALREADY WORKING (No API Keys Needed)**

These features work without any API keys:
- ✅ All CRUD operations (Drivers, Trucks, Routes, Loads, etc.)
- ✅ Dashboard and Analytics
- ✅ Accounting (Invoices, Expenses, Settlements)
- ✅ ELD Manual Entry and Viewing
- ✅ Maintenance Scheduling
- ✅ Predictive Maintenance (already implemented!)
- ✅ Reports (Revenue, P&L, Driver Payments, IFTA)
- ✅ Documents Upload and Storage
- ✅ BOL Management
- ✅ CRM (Customers, Vendors)
- ✅ Settings (All save functions work!)
- ✅ Users Management
- ✅ Alerts and Reminders
- ✅ Fleet Map (shows vehicles if GPS data exists)

---

## 🔑 **API KEYS NEEDED FOR FULL FUNCTIONALITY**

### 1. **Google Maps API** (For Route Optimization)
**What it enables:**
- Advanced multi-stop route optimization
- Real-time traffic integration
- Distance and time calculations
- Geocoding addresses

**How to get it:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select existing
3. Enable "Maps JavaScript API" and "Directions API"
4. Create API key
5. Restrict key to your domain (recommended)

**Environment Variable:**
```env
GOOGLE_MAPS_API_KEY=your_api_key_here
```

**Where it's used:**
- `app/actions/integrations-google-maps.ts`
- `app/actions/route-optimization.ts`
- `app/dashboard/routes/optimize/page.tsx`

---

### 2. **Google Gemini API** (For Document AI Analysis)
**What it enables:**
- AI-powered document analysis
- Automatic data extraction from invoices, BOLs, PDFs, images, etc.
- Smart document categorization
- Supports both images and PDFs natively

**How to get it:**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key

**Environment Variable:**
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
**Alternative:** You can also use `GOOGLE_AI_API_KEY` (same value)

**Where it's used:**
- `app/actions/document-analysis.ts`
- `app/dashboard/upload-document/page.tsx`

**Note:** Gemini API has a free tier with generous limits, making it cost-effective for document analysis.

---

### 3. **Resend API** (For Email Notifications)
**What it enables:**
- Send invoice emails
- Send reminder emails
- Send notification emails
- Customer portal emails

**How to get it:**
1. Go to [Resend](https://resend.com/)
2. Sign up for free account
3. Verify your domain (or use Resend's domain)
4. Get API key from dashboard

**Environment Variable:**
```env
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

**Where it's used:**
- `app/actions/invoice-email.ts`
- `app/actions/notifications.ts`
- `app/actions/customer-portal.ts`
- `app/actions/reminders.ts`

---

### 4. **Twilio API** (For SMS Notifications)
**What it enables:**
- SMS reminders
- SMS alerts
- SMS notifications to drivers

**How to get it:**
1. Go to [Twilio](https://www.twilio.com/)
2. Sign up for account
3. Get Account SID and Auth Token
4. Get phone number (or use trial number)

**Environment Variables:**
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

**Where it's used:**
- `app/actions/sms.ts`
- `app/actions/notifications.ts`
- `app/actions/reminders.ts`

**Note:** Twilio is optional - the code handles it gracefully if not installed.

---

### 5. **QuickBooks API** (For Accounting Integration)
**What it enables:**
- Sync invoices to QuickBooks
- Sync expenses to QuickBooks
- Two-way data sync

**How to get it:**
1. Go to [Intuit Developer](https://developer.intuit.com/)
2. Create app
3. Get OAuth 2.0 credentials (Client ID, Client Secret)
4. Set up OAuth flow

**Environment Variables:**
```env
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret
QUICKBOOKS_REDIRECT_URI=https://yourdomain.com/api/quickbooks/callback
```

**Where it's used:**
- `app/actions/integrations-quickbooks.ts`
- `app/dashboard/settings/integration/page.tsx`

**Note:** Users can also enter QuickBooks credentials in Integration Settings page.

---

### 6. **Stripe API** (For Payment Processing)
**What it enables:**
- Process invoice payments
- Accept credit card payments
- Payment tracking

**How to get it:**
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Get API keys (Publishable Key and Secret Key)
3. Use test keys for development, live keys for production

**Environment Variables:**
```env
STRIPE_PUBLISHABLE_KEY=pk_test_your_key
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

**Where it's used:**
- `app/actions/integrations-stripe.ts`
- `app/dashboard/settings/integration/page.tsx`

**Note:** Users can also enter Stripe API key in Integration Settings page.

---

### 7. **PayPal API** (For Payment Processing)
**What it enables:**
- Process PayPal payments
- Accept PayPal for invoices

**How to get it:**
1. Go to [PayPal Developer](https://developer.paypal.com/)
2. Create app
3. Get Client ID and Secret
4. Use sandbox for testing, live for production

**Environment Variables:**
```env
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_MODE=sandbox  # or 'live' for production
```

**Where it's used:**
- `app/actions/paypal.ts`
- `app/actions/integrations-stripe.ts` (includes PayPal)
- `app/dashboard/settings/integration/page.tsx`

**Note:** Users can also enter PayPal Client ID in Integration Settings page.

---

### 8. **ELD Device Integration** (For Real-Time GPS Tracking)
**What it enables:**
- Real-time vehicle location tracking
- Automatic HOS log sync
- ELD device data integration

**Supported Providers:**
- KeepTruckin (Motive)
- Samsara
- Geotab
- Rand McNally
- Custom ELD devices

**How to set it up:**
1. Users enter ELD device credentials in Integration Settings
2. Or configure in `app/actions/eld-sync.ts`
3. API credentials are stored per company in `company_integrations` table

**Where it's used:**
- `app/actions/eld-sync.ts`
- `app/dashboard/eld/devices/page.tsx`
- `app/dashboard/fleet-map/page.tsx`

**Note:** Each ELD provider has different API requirements. The code supports KeepTruckin by default.

---

## 📋 **COMPLETE ENVIRONMENT VARIABLES LIST**

Create a `.env.local` file with all these variables:

```env
# Supabase (Required - Already configured)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Maps (For Route Optimization)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Google Gemini (For Document Analysis)
GEMINI_API_KEY=your_gemini_api_key

# Resend (For Email)
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Twilio (For SMS - Optional)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# QuickBooks (For Accounting Integration - Optional)
QUICKBOOKS_CLIENT_ID=your_quickbooks_client_id
QUICKBOOKS_CLIENT_SECRET=your_quickbooks_client_secret
QUICKBOOKS_REDIRECT_URI=https://yourdomain.com/api/quickbooks/callback

# Stripe (For Payments - Optional)
STRIPE_PUBLISHABLE_KEY=pk_test_your_key
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# PayPal (For Payments - Optional)
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox

# App URL (For OAuth callbacks)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## 🎯 **PRIORITY ORDER FOR SETUP**

### **High Priority** (Core Features)
1. ✅ **Google Maps API** - Route optimization is a key feature
2. ✅ **Resend API** - Email notifications are important
3. ✅ **Google Gemini API** - Document analysis adds value (free tier available)

### **Medium Priority** (Nice to Have)
4. ✅ **Twilio API** - SMS notifications
5. ✅ **Stripe/PayPal** - Payment processing

### **Low Priority** (Advanced Features)
6. ✅ **QuickBooks API** - Accounting integration
7. ✅ **ELD Device APIs** - Real-time tracking (varies by provider)

---

## 🔧 **HOW TO ADD API KEYS**

1. **Add to `.env.local` file:**
   ```bash
   # Copy env.example to .env.local if it doesn't exist
   cp env.example .env.local
   
   # Add your API keys
   nano .env.local
   ```

2. **Restart your development server:**
   ```bash
   npm run dev
   ```

3. **For production (Vercel):**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add each API key as an environment variable
   - Redeploy

---

## ✅ **VERIFICATION CHECKLIST**

After adding API keys, verify these features work:

- [ ] Route Optimization page (`/dashboard/routes/optimize`) - Test with Google Maps API
- [ ] Document Upload & Analysis (`/dashboard/upload-document`) - Test with Gemini API
- [ ] Send Invoice Email (from invoice page) - Test with Resend API
- [ ] SMS Notifications (if Twilio configured) - Test SMS sending
- [ ] QuickBooks Sync (if configured) - Test invoice sync
- [ ] Stripe Payment (if configured) - Test payment processing
- [ ] PayPal Payment (if configured) - Test payment processing

---

## 📝 **NOTES**

1. **All features work without API keys** - They just won't have advanced functionality
2. **API keys can be added incrementally** - Add them as needed
3. **Users can enter some API keys in Settings** - Integration Settings page allows per-company API keys
4. **Environment variables are server-side only** - Safe to commit `.env.example` but never commit `.env.local`

---

## 🆘 **TROUBLESHOOTING**

**Route Optimization not working:**
- Check `GOOGLE_MAPS_API_KEY` is set
- Verify Google Maps API is enabled in Google Cloud Console
- Check API key restrictions allow your domain

**Document Analysis not working:**
- Check `GEMINI_API_KEY` is set
- Verify you have Gemini API quota (free tier available)
- Check API key permissions in Google AI Studio

**Email not sending:**
- Check `RESEND_API_KEY` is set
- Verify domain is verified in Resend
- Check `RESEND_FROM_EMAIL` is correct

**SMS not sending:**
- Check Twilio credentials are set
- Verify Twilio account has credits
- Check phone number format

---

**Last Updated:** Current Date
**Status:** Ready for API key configuration

