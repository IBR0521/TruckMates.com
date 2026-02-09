# Integrations API Documentation

API endpoints for third-party integrations (QuickBooks, Stripe, PayPal).

## Base URL

All integration endpoints are prefixed with `/api/`

## QuickBooks OAuth

OAuth 2.0 callback endpoint for QuickBooks integration.

**Endpoint:** `GET /api/quickbooks/callback`

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | Yes | Authorization code from QuickBooks |
| `state` | string | Yes | State parameter (should contain company_id) |
| `realmId` | string | Yes | QuickBooks Company ID |
| `error` | string | No | Error code if OAuth failed |

### Response

Redirects to integration settings page with success/error parameters:

**Success:**
```
/dashboard/settings/integration?quickbooks_success=true
```

**Error:**
```
/dashboard/settings/integration?quickbooks_error=<error_message>
```

### OAuth Flow

1. User clicks "Connect QuickBooks" in integration settings
2. User is redirected to QuickBooks authorization page
3. User authorizes the application
4. QuickBooks redirects to `/api/quickbooks/callback` with authorization code
5. Endpoint exchanges code for access/refresh tokens
6. Tokens are stored in `company_integrations` table
7. User is redirected back to settings page

### Environment Variables

Required:
- `QUICKBOOKS_CLIENT_ID` - QuickBooks App Client ID
- `QUICKBOOKS_CLIENT_SECRET` - QuickBooks App Client Secret
- `QUICKBOOKS_REDIRECT_URI` - Must match redirect URI in QuickBooks app settings
- `QUICKBOOKS_SANDBOX` - Set to "true" for sandbox, "false" for production

### Error Codes

| Error | Description |
|-------|-------------|
| `missing_parameters` | Missing code, state, or realmId |
| `token_exchange_failed` | Failed to exchange authorization code for tokens |
| `no_company` | User has no associated company |
| `database_error` | Failed to store tokens in database |

### Notes

- Tokens are automatically refreshed when expired
- Sandbox and production use different QuickBooks API endpoints
- State parameter should be validated in production (currently uses company_id directly)

---

## Stripe Webhooks

Webhook endpoint for Stripe payment events.

**Endpoint:** `POST /api/webhooks/stripe`

### Authentication

Stripe webhook signature verification is required. Stripe sends the signature in the `stripe-signature` header.

### Request Headers

```
stripe-signature: <stripe-webhook-signature>
Content-Type: application/json
```

### Webhook Events

The endpoint handles the following Stripe events:

#### checkout.session.completed

Triggered when a checkout session is completed.

**Event Data:**
```json
{
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_xxx",
      "metadata": {
        "company_id": "uuid",
        "plan_id": "uuid"
      }
    }
  }
}
```

**Action:** Logs checkout completion (subscription created by `customer.subscription.created` event).

#### customer.subscription.created
#### customer.subscription.updated

Triggered when a subscription is created or updated.

**Event Data:**
```json
{
  "type": "customer.subscription.created",
  "data": {
    "object": {
      "id": "sub_xxx",
      "customer": "cus_xxx",
      "status": "active",
      "metadata": {
        "company_id": "uuid",
        "plan_id": "uuid"
      },
      "current_period_start": 1234567890,
      "current_period_end": 1234567890,
      "items": {
        "data": [{
          "price": {
            "id": "price_xxx"
          }
        }]
      }
    }
  }
}
```

**Action:** Creates or updates subscription in `subscriptions` table.

#### customer.subscription.deleted

Triggered when a subscription is canceled.

**Event Data:**
```json
{
  "type": "customer.subscription.deleted",
  "data": {
    "object": {
      "id": "sub_xxx",
      "metadata": {
        "company_id": "uuid"
      }
    }
  }
}
```

**Action:** Updates subscription status to "canceled" in database.

#### invoice.paid

Triggered when an invoice is paid.

**Event Data:**
```json
{
  "type": "invoice.paid",
  "data": {
    "object": {
      "id": "in_xxx",
      "subscription": "sub_xxx",
      "amount_paid": 10000,
      "currency": "usd",
      "status": "paid",
      "invoice_pdf": "https://...",
      "hosted_invoice_url": "https://..."
    }
  }
}
```

**Action:** Stores invoice in `invoices` table.

#### invoice.payment_failed

Triggered when invoice payment fails.

**Event Data:**
```json
{
  "type": "invoice.payment_failed",
  "data": {
    "object": {
      "id": "in_xxx",
      "subscription": "sub_xxx"
    }
  }
}
```

**Action:** Updates subscription status to "past_due".

### Response

**Success (200):**

```json
{
  "received": true
}
```

**Error (400):**

```json
{
  "error": "Webhook Error: Invalid signature"
}
```

### Setup

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy webhook signing secret
5. Add to environment variables: `STRIPE_WEBHOOK_SECRET`

### Environment Variables

Required:
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret from Stripe dashboard

### Security

- Webhook signature is verified using Stripe's SDK
- Invalid signatures are rejected with 400 error
- Only events from Stripe are processed

---

## PayPal Webhooks

Webhook endpoint for PayPal payment events.

**Endpoint:** `POST /api/webhooks/paypal`

### Authentication

PayPal webhook verification is performed (simplified in current implementation).

### Webhook Events

The endpoint handles the following PayPal events:

#### BILLING.SUBSCRIPTION.CREATED
#### BILLING.SUBSCRIPTION.ACTIVATED

Triggered when a subscription is created or activated.

**Event Data:**
```json
{
  "event_type": "BILLING.SUBSCRIPTION.CREATED",
  "resource": {
    "id": "I-BW452GLLEP1G",
    "subscriber": {
      "email_address": "user@example.com"
    },
    "plan_id": "P-xxx"
  }
}
```

**Action:** Creates or updates subscription in `subscriptions` table.

#### BILLING.SUBSCRIPTION.CANCELLED
#### BILLING.SUBSCRIPTION.EXPIRED

Triggered when a subscription is canceled or expired.

**Event Data:**
```json
{
  "event_type": "BILLING.SUBSCRIPTION.CANCELLED",
  "resource": {
    "id": "I-BW452GLLEP1G"
  }
}
```

**Action:** Updates subscription status to "canceled".

#### PAYMENT.SALE.COMPLETED

Triggered when a payment is completed.

**Event Data:**
```json
{
  "event_type": "PAYMENT.SALE.COMPLETED",
  "resource": {
    "billing_agreement_id": "I-BW452GLLEP1G"
  }
}
```

**Action:** Updates subscription status to "active".

### Response

**Success (200):**

```json
{
  "received": true
}
```

**Error (500):**

```json
{
  "error": "Error message"
}
```

### Setup

1. Go to PayPal Developer Dashboard → My Apps & Credentials
2. Create a webhook
3. Add endpoint: `https://your-domain.com/api/webhooks/paypal`
4. Select events to listen to:
   - `BILLING.SUBSCRIPTION.CREATED`
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.EXPIRED`
   - `PAYMENT.SALE.COMPLETED`
5. Copy webhook ID
6. Add to environment variables: `PAYPAL_WEBHOOK_ID`

### Environment Variables

Required:
- `PAYPAL_CLIENT_ID` - PayPal app client ID
- `PAYPAL_CLIENT_SECRET` - PayPal app client secret
- `PAYPAL_MODE` - "sandbox" or "live"
- `PAYPAL_WEBHOOK_ID` - Webhook ID from PayPal dashboard

### Notes

- Current implementation uses simplified webhook verification
- In production, implement full PayPal webhook signature verification
- Plan ID mapping from PayPal to internal plan_id needs to be configured

---

## Error Codes

| Code | Description |
|------|-------------|
| `OAUTH_ERROR` | QuickBooks OAuth error |
| `WEBHOOK_SIGNATURE_INVALID` | Invalid webhook signature |
| `WEBHOOK_NOT_CONFIGURED` | Webhook service not configured |
| `SUBSCRIPTION_NOT_FOUND` | Subscription not found in database |
| `MISSING_METADATA` | Required metadata missing from webhook event |

## Best Practices

1. **Webhook Security**: Always verify webhook signatures
2. **Idempotency**: Handle duplicate webhook events gracefully
3. **Error Handling**: Log all webhook errors for debugging
4. **Retry Logic**: Implement retry logic for failed webhook processing
5. **Testing**: Use Stripe/PayPal test webhooks for development

## Example Usage

### QuickBooks OAuth Flow

```typescript
// Initiate OAuth (in integration settings page)
const initiateQuickBooksOAuth = async () => {
  const companyId = await getCompanyId()
  const redirectUri = `${APP_URL}/api/quickbooks/callback`
  const state = companyId // In production, use encrypted state
  
  const authUrl = `https://appcenter.intuit.com/connect/oauth2?` +
    `client_id=${QUICKBOOKS_CLIENT_ID}&` +
    `scope=com.intuit.quickbooks.accounting&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `state=${state}&` +
    `access_type=offline`
  
  window.location.href = authUrl
}
```

### Stripe Webhook Testing

```bash
# Test webhook locally using Stripe CLI
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test event
stripe trigger checkout.session.completed
```

### PayPal Webhook Testing

Use PayPal's webhook simulator in the developer dashboard to test events.





