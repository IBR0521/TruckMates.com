# OpenAI Rate Limit Fix

## What Happened

You hit OpenAI's rate limit. This means you've used up your allowed tokens per minute (TPM).

## Solutions

### Option 1: Add Payment Method (Recommended - Instant Fix)

1. **Go to:** https://platform.openai.com/account/billing
2. **Add a payment method** (credit card)
3. **Your rate limits will increase automatically**
4. **Try uploading again** - it should work immediately

### Option 2: Wait for Rate Limit Reset

- The error says: "Please try again in 10h57m56.16s"
- Wait for the time limit to reset
- Then try again

### Option 3: Use a Different Model (If Available)

If you have access to other models, you can change the model in the code. However, `gpt-4o-mini` is already the cheapest option.

## What I've Done

I've updated the code to:
1. Show a clearer error message when rate limits are hit
2. Add `max_tokens` limit to reduce token usage
3. Better error handling for rate limit errors

## Prevention Tips

1. **Add a payment method** - This gives you much higher rate limits
2. **Monitor your usage** - Check https://platform.openai.com/usage
3. **Use smaller documents** - Larger documents use more tokens
4. **Space out requests** - Don't upload many documents at once

## After Adding Payment Method

Once you add a payment method:
1. Refresh your browser
2. Try uploading the document again
3. It should work without rate limit errors

## Cost Estimate

With a payment method:
- **gpt-4o-mini:** ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **Typical document analysis:** ~$0.01-0.05 per document
- **Very affordable** for most use cases
