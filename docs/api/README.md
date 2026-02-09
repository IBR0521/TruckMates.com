# TruckMates API Documentation

Welcome to the TruckMates API documentation. This guide provides comprehensive information about all available API endpoints.

## Table of Contents

- [Authentication](#authentication)
- [Base URL](#base-url)
- [Rate Limits](#rate-limits)
- [Error Handling](#error-handling)
- [API Endpoints](#api-endpoints)
  - [ELD Mobile API](#eld-mobile-api)
  - [Integration APIs](#integration-apis)
  - [Webhook APIs](#webhook-apis)
  - [Utility APIs](#utility-apis)

## Authentication

All API endpoints require authentication using Supabase Auth. Include the authentication token in the request headers:

```
Authorization: Bearer <your-supabase-auth-token>
```

For mobile app endpoints, the token is automatically included when using the Supabase client SDK.

## Base URL

Production: `https://your-domain.com/api`
Development: `http://localhost:3000/api`

## Rate Limits

- **Standard endpoints**: 100 requests per minute per user
- **Mobile ELD endpoints**: 200 requests per minute per device
- **Webhook endpoints**: No rate limit (handled by external services)

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when rate limit resets (Unix timestamp)

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE",
  "details": {}
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error
- `503` - Service Unavailable (external service error)

## API Endpoints

### ELD Mobile API

Endpoints for mobile ELD app integration:

- [Device Registration](./eld-api.md#register-device) - `POST /api/eld/mobile/register`
- [GPS Location Updates](./eld-api.md#location-updates) - `POST /api/eld/mobile/locations`
- [HOS Log Sync](./eld-api.md#hos-logs) - `POST /api/eld/mobile/logs`
- [Event/Violation Reporting](./eld-api.md#events) - `POST /api/eld/mobile/events`

See [ELD API Documentation](./eld-api.md) for detailed endpoint documentation.

### Integration APIs

Third-party integration endpoints:

- [QuickBooks OAuth Callback](./integrations-api.md#quickbooks-oauth) - `GET /api/quickbooks/callback`

See [Integrations API Documentation](./integrations-api.md) for detailed endpoint documentation.

### Webhook APIs

Webhook endpoints for external services:

- [Stripe Webhooks](./integrations-api.md#stripe-webhooks) - `POST /api/webhooks/stripe`
- [PayPal Webhooks](./integrations-api.md#paypal-webhooks) - `POST /api/webhooks/paypal`

See [Integrations API Documentation](./integrations-api.md) for detailed webhook documentation.

### Utility APIs

Utility and testing endpoints:

- [Get Company Type](./mobile-api.md#get-company-type) - `GET /api/get-company-type`
- [Test Connection](./mobile-api.md#test-connection) - `GET /api/test-connection`
- [ELD Sync Cron](./mobile-api.md#eld-sync-cron) - `GET /api/cron/sync-eld`
- [Checkout Success](./mobile-api.md#checkout-success) - `GET /api/checkout-success`

See [Mobile API Documentation](./mobile-api.md) for detailed endpoint documentation.

## Response Format

All successful responses follow this format:

```json
{
  "success": true,
  "data": {},
  "message": "Optional success message"
}
```

Error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## SDKs and Libraries

### JavaScript/TypeScript

Use the Supabase JavaScript client:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

### React Native

Use the Supabase React Native client:

```typescript
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
  },
})
```

## Support

For API support, please contact:
- Email: support@truckmates.com
- Documentation: https://docs.truckmates.com
- Status Page: https://status.truckmates.com





