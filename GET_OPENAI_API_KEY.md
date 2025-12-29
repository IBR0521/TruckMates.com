# How to Get OpenAI API Key

## Quick Steps

1. **Visit OpenAI Platform**
   - Go to: https://platform.openai.com/
   - Sign up for a new account or log in if you already have one

2. **Navigate to API Keys**
   - Direct link: https://platform.openai.com/api-keys
   - Or: Click your profile icon → "API keys" from the menu

3. **Create a New Secret Key**
   - Click the "Create new secret key" button
   - Give it a name (e.g., "TruckMates Document Analysis")
   - Click "Create secret key"
   - **IMPORTANT:** Copy the key immediately - you won't be able to see it again!

4. **Add Payment Method** (Required)
   - Go to: https://platform.openai.com/account/billing
   - Click "Add payment method"
   - Add a credit/debit card
   - **Note:** OpenAI charges per API call (very affordable - usually $0.01-0.10 per document analysis)

## Pricing Information

- **GPT-4o-mini** (used for document analysis): ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **Typical document analysis:** Costs around $0.01-0.10 depending on document size
- **Free tier:** $5 free credit when you first sign up (enough for testing)

## Add to Your Project

1. Open your `.env.local` file in the project root
2. Add this line:
   ```env
   OPENAI_API_KEY=sk-your-actual-key-here
   ```
3. Replace `sk-your-actual-key-here` with the key you copied
4. Save the file
5. Restart your development server (`npm run dev`)

## Security Notes

- ✅ **DO:** Keep your API key in `.env.local` (this file is gitignored)
- ❌ **DON'T:** Commit your API key to Git
- ❌ **DON'T:** Share your API key publicly
- ✅ **DO:** Use different keys for development and production

## Troubleshooting

### "Invalid API key" error
- Make sure you copied the entire key (starts with `sk-`)
- Check for extra spaces or line breaks
- Verify the key is in `.env.local` (not `.env`)

### "Rate limit" error
- You may have hit the free tier limit
- Add a payment method to increase limits
- Wait a few minutes and try again

### "Insufficient credits" error
- Add a payment method at https://platform.openai.com/account/billing
- The free $5 credit may have been used up

## Alternative Options

If you don't want to use OpenAI, you can:
1. **Disable document analysis** - Users can still upload documents manually
2. **Use other AI services** - Google Cloud Vision, AWS Textract, etc. (requires code changes)
3. **Manual entry only** - Remove the AI analysis feature entirely

## Need Help?

- OpenAI Support: https://help.openai.com/
- OpenAI Discord: https://discord.gg/openai
- Documentation: https://platform.openai.com/docs

