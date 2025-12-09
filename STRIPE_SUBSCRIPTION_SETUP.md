# Stripe Subscription Setup Guide

## ✅ Complete Subscription System with 7-Day Free Trial

Your subscription system is now fully integrated with Stripe and includes:
- ✅ 7-day free trial
- ✅ Automatic payment after trial
- ✅ Subscription management
- ✅ Billing history
- ✅ Cancel/reactivate subscriptions

---

## 🚀 Setup Steps

### Step 1: Create Stripe Account

1. Go to **https://stripe.com**
2. Click **"Sign Up"**
3. Create your account
4. Complete business verification

### Step 2: Get Stripe API Keys

1. Go to **Stripe Dashboard** → **Developers** → **API Keys**
2. Copy your keys:
   - **Publishable Key** (starts with `pk_test_` or `pk_live_`)
   - **Secret Key** (starts with `sk_test_` or `sk_live_`)

**Important:** Use test keys for development, live keys for production!

### Step 3: Set Up Webhook

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click **"Add endpoint"**
3. Enter endpoint URL:
   ```
   https://your-domain.com/api/webhooks/stripe
   ```
   (For local testing: use Stripe CLI - see below)
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Copy the **Webhook Signing Secret** (starts with `whsec_`)

### Step 4: Add Environment Variables

**In Vercel (Production):**
1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add these variables:

```
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

**In `.env.local` (Development):**
```env
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 5: Run Database Migration

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open `supabase/subscriptions_schema.sql`
3. Copy and paste entire file
4. Click **"Run"**

This creates:
- `subscription_plans` table
- `subscriptions` table
- `payment_methods` table
- `invoices` table

### Step 6: Test the Integration

1. **Test Mode:**
   - Use Stripe test cards: `4242 4242 4242 4242`
   - Any future expiry date
   - Any CVC
   - Any ZIP code

2. **Test Flow:**
   - Select a plan
   - Enter test card
   - Complete checkout
   - Check subscription in Stripe Dashboard
   - Verify subscription in your SaaS

---

## 🧪 Local Testing with Stripe CLI

### Install Stripe CLI:

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Or download from: https://stripe.com/docs/stripe-cli
```

### Forward Webhooks to Local:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

This will give you a webhook secret starting with `whsec_` - use this in your `.env.local`

---

## 💳 How It Works

### User Flow:

1. **User selects plan** → Clicks "Start Free Trial"
2. **Stripe Checkout opens** → User enters payment method
3. **7-day trial starts** → No charge yet
4. **After 7 days** → Stripe automatically charges
5. **Subscription active** → User has full access

### Payment Flow:

```
User selects plan
    ↓
Stripe Checkout (payment method required)
    ↓
7-day free trial starts
    ↓
Trial period (7 days)
    ↓
Stripe automatically charges
    ↓
Subscription active
    ↓
Monthly automatic billing
```

---

## 📊 Subscription Plans

### Starter - $29/month
- 10 vehicles, 15 drivers, 10 employees
- Basic features
- 7-day free trial

### Professional - $59/month ⭐
- 30 vehicles, 40 drivers, 25 employees
- ELD integration
- Advanced features
- 7-day free trial

### Enterprise - $99/month
- Unlimited everything
- All features
- 7-day free trial

---

## 🔧 Features Implemented

### ✅ Subscription Management:
- Create subscription with 7-day trial
- View current subscription
- Cancel subscription (at period end)
- Reactivate subscription
- View billing history

### ✅ Automatic Billing:
- Stripe handles all payments
- Automatic charge after trial
- Monthly recurring billing
- Failed payment handling

### ✅ Webhook Integration:
- Real-time subscription updates
- Invoice tracking
- Payment status updates
- Subscription status sync

---

## 💰 Money Goes to Your Stripe Account

### How Payments Work:

1. **User pays** → Money goes to your Stripe account
2. **Stripe processes** → Handles payment
3. **Funds available** → In your Stripe balance
4. **Transfer to bank** → Set up in Stripe Dashboard

### Set Up Bank Transfer:

1. Go to **Stripe Dashboard** → **Settings** → **Bank accounts and scheduling**
2. Add your bank account (Visa card won't work - need bank account)
3. Set up automatic transfers
4. Money will be transferred to your bank automatically

**Note:** Stripe doesn't transfer to Visa cards - you need a bank account. The payment method users enter is for charging them, not for receiving money.

---

## 🎯 What You Need to Do

### 1. Get Stripe Account ✅
- Sign up at stripe.com
- Complete verification

### 2. Get API Keys ✅
- Copy from Stripe Dashboard
- Add to environment variables

### 3. Set Up Webhook ✅
- Add webhook endpoint
- Copy webhook secret
- Add to environment variables

### 4. Run Database Migration ✅
- Run `supabase/subscriptions_schema.sql`

### 5. Test ✅
- Use test mode
- Test checkout flow
- Verify webhooks work

---

## 🆘 Troubleshooting

### "Stripe key not found"
- Make sure `STRIPE_SECRET_KEY` is set in environment variables
- Check key starts with `sk_test_` or `sk_live_`

### "Webhook verification failed"
- Check `STRIPE_WEBHOOK_SECRET` is correct
- Make sure webhook endpoint URL is correct
- For local testing, use Stripe CLI

### "Subscription not created"
- Check webhook is receiving events
- Verify webhook secret is correct
- Check Stripe Dashboard → Events for errors

### "Payment failed"
- Check card details are correct
- Verify Stripe account is activated
- Check Stripe Dashboard for error details

---

## 📝 Summary

**Everything is set up!** You just need to:

1. ✅ Get Stripe API keys
2. ✅ Set up webhook
3. ✅ Add environment variables
4. ✅ Run database migration
5. ✅ Test!

**Once set up, users can:**
- Start 7-day free trial
- Get automatically charged after trial
- Manage subscriptions
- View billing history

**Money goes to your Stripe account, then you transfer to your bank!** 💰

