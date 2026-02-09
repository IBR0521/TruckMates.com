# Mobile & Utility API Documentation

API endpoints for mobile app integration and utility functions.

## Base URL

All endpoints are prefixed with `/api/`

## Authentication

Most endpoints require authentication via Supabase Auth token. Exceptions are noted in endpoint documentation.

## Get Company Type

Get the company type for the authenticated user.

**Endpoint:** `GET /api/get-company-type`

### Authentication

Required: Yes (Supabase Auth token)

### Response

**Success (200):**

```json
{
  "data": "broker"
}
```

Possible values:
- `"broker"` - Broker company
- `"carrier"` - Carrier company
- `"both"` - Both broker and carrier
- `null` - Regular company (no special type)

**Error (401):**

```json
{
  "error": "Not authenticated"
}
```

### Example Usage

```typescript
const getCompanyType = async () => {
  const response = await fetch('/api/get-company-type', {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  })
  const result = await response.json()
  return result.data // "broker", "carrier", "both", or null
}
```

---

## Test Connection

Test database connection and API health.

**Endpoint:** `GET /api/test-connection`

### Authentication

Required: Yes (Supabase Auth token)

### Response

**Success (200):**

```json
{
  "success": true,
  "message": "Connection successful",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Error (500):**

```json
{
  "success": false,
  "error": "Connection failed",
  "code": "PGRST_ERROR",
  "details": {},
  "hint": "Check database connection"
}
```

### Use Cases

- Health checks
- Connection diagnostics
- API availability testing

---

## ELD Sync Cron

Scheduled endpoint to sync all ELD devices. Typically called by a cron job.

**Endpoint:** `GET /api/cron/sync-eld`

### Authentication

Required: Yes (Authorization header with CRON_SECRET)

### Headers

```
Authorization: Bearer <CRON_SECRET>
```

The `CRON_SECRET` must match the `CRON_SECRET` environment variable.

### Response

**Success (200):**

```json
{
  "success": true,
  "data": {
    "synced": 5,
    "failed": 0
  },
  "message": "Synced 5 devices, 0 failed"
}
```

**Error (401):**

```json
{
  "error": "Unauthorized"
}
```

**Error (500):**

```json
{
  "success": false,
  "error": "Sync failed",
  "data": {
    "synced": 3,
    "failed": 2
  }
}
```

### Setup

Configure in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-eld",
      "schedule": "0 0 * * *"
    }
  ]
}
```

Or use external cron service (cron-job.org, EasyCron, etc.) with:
- URL: `https://your-domain.com/api/cron/sync-eld`
- Method: GET
- Headers: `Authorization: Bearer <CRON_SECRET>`
- Schedule: Daily at midnight UTC

### Notes

- Syncs all active ELD devices for all companies
- Processes devices in parallel
- Updates `last_sync_at` timestamp for each device
- Handles errors gracefully (continues with other devices if one fails)

---

## Checkout Success

Redirect endpoint after successful payment checkout.

**Endpoint:** `GET /api/checkout-success`

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `session_id` | string | Yes | Stripe checkout session ID |

### Response

Redirects to `/dashboard?subscription=success`

### Notes

- This endpoint is called by Stripe after successful checkout
- The actual subscription creation is handled by the Stripe webhook
- This endpoint just confirms checkout completion and redirects the user

### Flow

1. User completes checkout on Stripe
2. Stripe redirects to `/api/checkout-success?session_id=xxx`
3. Endpoint redirects to `/dashboard?subscription=success`
4. Stripe webhook (`/api/webhooks/stripe`) creates/updates subscription in database

---

## Error Codes

| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | Authentication token missing or invalid |
| `CRON_SECRET_INVALID` | Invalid cron secret for scheduled endpoints |
| `CONNECTION_FAILED` | Database connection failed |
| `INVALID_SESSION` | Invalid checkout session ID |

## Rate Limits

- **Get Company Type**: 60 requests per minute
- **Test Connection**: 10 requests per minute
- **ELD Sync Cron**: No rate limit (scheduled only)
- **Checkout Success**: No rate limit (redirect only)

## Best Practices

1. **Caching**: Cache company type results to reduce API calls
2. **Health Checks**: Use test-connection endpoint for monitoring
3. **Error Handling**: Always check response status and handle errors
4. **Cron Security**: Keep CRON_SECRET secure and rotate regularly

## Example Usage

### Get Company Type

```typescript
// Cache the result
let cachedCompanyType: string | null = null

const getCompanyType = async (forceRefresh = false) => {
  if (cachedCompanyType && !forceRefresh) {
    return cachedCompanyType
  }
  
  const response = await fetch('/api/get-company-type', {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  })
  
  const result = await response.json()
  cachedCompanyType = result.data
  return cachedCompanyType
}
```

### Test Connection

```typescript
const testConnection = async () => {
  try {
    const response = await fetch('/api/test-connection', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    })
    const result = await response.json()
    return result.success
  } catch (error) {
    console.error('Connection test failed:', error)
    return false
  }
}
```

### Setup Cron Job

Using Vercel Cron:

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/sync-eld",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Using External Service:

1. Go to cron-job.org or similar service
2. Create new cron job
3. URL: `https://your-domain.com/api/cron/sync-eld`
4. Method: GET
5. Headers: `Authorization: Bearer <your-cron-secret>`
6. Schedule: Every 6 hours (`0 */6 * * *`)





