# API Protection Guide

## Overview

Since all users share platform-wide API keys (Google Maps, OpenAI, Resend), we've implemented protection mechanisms to prevent abuse and manage costs.

## Protection Mechanisms

### 1. **Rate Limiting** ✅
- **Per-company rate limits** to prevent any single company from exhausting API quotas
- **Different limits per API**:
  - Google Maps: 100 calls/minute per company
  - OpenAI: 50 calls/minute per company
  - Resend: 200 emails/minute per company

### 2. **Caching** ✅
- **Expensive API calls are cached** (like Google Maps routes)
- Cache duration: 1 hour for route calculations
- Reduces API costs and improves performance

### 3. **Usage Tracking** (Optional)
- Daily usage logs for monitoring
- Can be used for billing or quota management
- Stored in `api_usage_log` table

## How It Works

### Rate Limiting Flow
```
User Request → Check Rate Limit → Allowed? → Make API Call
                      ↓ No
                  Return Error with Retry Time
```

### Caching Flow
```
User Request → Check Cache → Found? → Return Cached Result
                      ↓ No
              Check Rate Limit → Make API Call → Cache Result
```

## Setup

### 1. Run Database Migration
```sql
-- Run this in Supabase SQL Editor
\i supabase/api_protection_schema.sql
```

### 2. Configure Rate Limits (Optional)
Edit `lib/api-protection.ts` to adjust limits:
```typescript
const limits: Record<string, { limit: number; window: number }> = {
  google_maps: { limit: 100, window: 60 }, // 100 calls per minute
  openai: { limit: 50, window: 60 }, // 50 calls per minute
  resend: { limit: 200, window: 60 }, // 200 emails per minute
}
```

### 3. Set Up Upstash Redis (Recommended for Production)
For better rate limiting in production:
1. Create Upstash Redis instance
2. Add to `.env.local`:
```env
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

## Monitoring

### Check API Usage
```sql
-- Daily usage by company
SELECT 
  company_id,
  api_name,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE success = false) as failed_calls
FROM api_usage_log
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY company_id, api_name;
```

### Check Cache Hit Rate
```sql
-- Cache effectiveness
SELECT 
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as active_cache
FROM api_cache;
```

## Cost Management

### Estimated Costs (with protections)

**Google Maps API:**
- Free tier: $200/month credit
- With 100 companies, 10 routes/day each = 1,000 routes/day
- Cost: ~$0.005 per route = $5/day = $150/month ✅ Within free tier

**OpenAI API:**
- GPT-4 Vision: ~$0.01 per image
- With 100 companies, 5 documents/day each = 500 documents/day
- Cost: $5/day = $150/month
- **Recommendation**: Use GPT-4o (cheaper) or add stricter limits

**Resend API:**
- Free tier: 3,000 emails/month
- With 100 companies, 10 emails/day each = 1,000 emails/day
- Cost: $0.10 per 1,000 emails = $3/day = $90/month
- **Recommendation**: Upgrade plan or add stricter limits

## Recommendations

### 1. **Monitor Usage**
- Set up alerts when API usage exceeds 80% of quota
- Review `api_usage_log` weekly

### 2. **Adjust Limits**
- Start with conservative limits
- Increase based on actual usage patterns
- Consider per-company quotas for enterprise customers

### 3. **Implement Caching Aggressively**
- Cache route calculations (already done)
- Cache geocoding results
- Cache document analysis for similar documents

### 4. **Consider Tiered Access**
- Free tier: Lower limits
- Paid tier: Higher limits
- Enterprise: Custom limits

### 5. **Fallback Mechanisms**
- If API fails, show graceful error
- For Google Maps: Fall back to basic route planning
- For OpenAI: Allow manual data entry
- For Resend: Queue emails for later

## Troubleshooting

### "Rate limit exceeded" errors
1. Check if a single company is making too many requests
2. Review `api_usage_log` for patterns
3. Temporarily increase limits if needed
4. Consider per-company quotas

### High API costs
1. Review usage logs
2. Increase cache duration
3. Add more aggressive caching
4. Consider requiring API keys for heavy users

### Cache not working
1. Check `api_cache` table exists
2. Verify RLS policies allow reads
3. Check cache expiration times

## Next Steps

1. ✅ Rate limiting implemented
2. ✅ Caching for Google Maps implemented
3. ⏳ Add caching for OpenAI (similar documents)
4. ⏳ Add usage dashboard for admins
5. ⏳ Set up alerts for quota warnings
6. ⏳ Implement per-company quotas




