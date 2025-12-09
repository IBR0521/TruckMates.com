# PayPal Setup Guide for Uzbekistan 🇺🇿

## ✅ Automatic Payment Processing with PayPal

PayPal supports Uzbekistan and allows automatic recurring payments from users' Visa/Mastercard cards directly to your PayPal account.

---

## 🚀 Setup Steps

### Step 1: Create PayPal Business Account

1. Go to **https://www.paypal.com/business**
2. Click **"Sign Up"**
3. Choose **"Business Account"**
4. Enter your business information
5. Verify your email
6. Complete business verification

### Step 2: Get PayPal API Credentials

1. Go to **PayPal Developer Dashboard**: https://developer.paypal.com
2. Log in with your PayPal business account
3. Go to **"My Apps & Credentials"**
4. Click **"Create App"**
5. Choose **"Merchant"** as app type
6. Name it (e.g., "TruckMates Logistics")
7. Copy your credentials:
   - **Client ID**
   - **Client Secret**

### Step 3: Set Up Webhook

1. In PayPal Developer Dashboard, go to **"Webhooks"**
2. Click **"Add Webhook"**
3. Enter webhook URL:
   ```
   https://your-domain.com/api/webhooks/paypal
   ```
   (For local testing: use ngrok or similar)
4. Select events to listen to:
   - `BILLING.SUBSCRIPTION.CREATED`
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.EXPIRED`
   - `PAYMENT.SALE.COMPLETED`
5. Copy the **Webhook ID**

### Step 4: Add Environment Variables

**In Vercel (Production):**
```
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_MODE=live
PAYPAL_WEBHOOK_ID=your_webhook_id
```

**In `.env.local` (Development):**
```
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
PAYPAL_MODE=sandbox
PAYPAL_WEBHOOK_ID=your_sandbox_webhook_id
```

### Step 5: Test

1. Use PayPal sandbox test accounts
2. Test subscription creation
3. Test payment processing
4. Verify webhooks work

---

## 💰 How It Works

### User Flow:

1. **User selects plan** → Clicks "Start Free Trial"
2. **PayPal checkout opens** → User logs in or enters card
3. **7-day trial starts** → No charge yet
4. **After 7 days** → PayPal automatically charges user's card
5. **Money goes to your PayPal account** → Automatic recurring billing

### Payment Flow:

```
User enters payment method (Visa/Mastercard)
    ↓
PayPal stores payment method
    ↓
7-day free trial starts
    ↓
User has full access (no charge)
    ↓
After 7 days
    ↓
PayPal automatically charges user's card
    ↓
Money goes to your PayPal account
    ↓
You can withdraw to bank account (when you get one)
```

---

## 💳 About Receiving Money

### Important:

**PayPal Account:**
- ✅ Money goes to your PayPal account automatically
- ✅ You can keep money in PayPal
- ✅ Withdraw to bank account when you get one
- ✅ Or use PayPal balance for online purchases

**Bank Account (Later):**
- When you get a bank account, you can withdraw from PayPal
- Transfer to your Uzbek bank account
- Or use PayPal balance directly

---

## 🎯 Features

### Automatic:
- ✅ 7-day free trial
- ✅ Automatic payment after trial
- ✅ Monthly recurring billing
- ✅ Automatic card charging
- ✅ Works with Visa/Mastercard

### You Receive:
- ✅ Money in PayPal account
- ✅ Automatic deposits
- ✅ Can withdraw to bank later
- ✅ Or use PayPal balance

---

## 📋 Next Steps

1. ✅ Create PayPal Business account
2. ✅ Get API credentials
3. ✅ Set up webhook
4. ✅ Add environment variables
5. ✅ Test!

**Once set up, users can:**
- Start 7-day free trial
- Pay with Visa/Mastercard
- Automatic recurring payments
- Money goes to your PayPal account automatically!

---

## 🆘 Troubleshooting

### "PayPal is not configured"
- Make sure `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are set
- Check environment variables in Vercel

### "Failed to create subscription"
- Check PayPal credentials are correct
- Verify PayPal mode (sandbox/live) matches your account

### "Webhook not working"
- Verify webhook URL is correct
- Check webhook events are selected
- Test with PayPal webhook simulator

---

## ✅ Summary

**PayPal is perfect for you because:**
- ✅ Supports Uzbekistan
- ✅ Automatic recurring payments
- ✅ Works with Visa/Mastercard
- ✅ Money goes to PayPal account
- ✅ Can withdraw to bank later
- ✅ Easy to set up

**You'll receive money automatically in your PayPal account!** 💰

