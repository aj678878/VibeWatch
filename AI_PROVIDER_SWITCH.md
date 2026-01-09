# Switching AI Providers Guide

This app supports multiple AI providers for movie recommendations. You can easily switch between them if one has issues.

## Available Providers

### 1. **Groq** (Default)
- **Free Tier**: Yes, generous free tier
- **Speed**: Very fast
- **Setup**: Get API key from https://console.groq.com/
- **Model**: `llama-3.1-8b-instant`

### 2. **Google Gemini** (Recommended Alternative)
- **Free Tier**: Yes, 60 requests/minute free
- **Speed**: Fast
- **Setup**: Get API key from https://aistudio.google.com/app/apikey
- **Model**: `gemini-1.5-flash`

### 3. **Fallback** (No AI)
- **Use Case**: When all AI providers fail
- **Behavior**: Returns error message asking user to try again

## How to Switch Providers

### Option 1: Environment Variable (Easiest)

1. **Go to Vercel Dashboard** → Your Project → Settings → Environment Variables

2. **Add or Update**:
   - **Key**: `AI_PROVIDER`
   - **Value**: `groq` or `gemini` or `fallback`
   - **Environment**: Production (and Preview if needed)

3. **Redeploy** your project

### Option 2: Local Development

Add to your `.env.local`:
```bash
# Use Groq (default)
AI_PROVIDER=groq

# OR use Gemini
AI_PROVIDER=gemini

# OR use fallback (no AI)
AI_PROVIDER=fallback
```

## Setting Up Each Provider

### Groq Setup

1. **Get API Key**:
   - Visit https://console.groq.com/
   - Sign up/login
   - Go to API Keys section
   - Create a new API key

2. **Add to Vercel**:
   - Key: `GROQ_API_KEY`
   - Value: Your Groq API key
   - Environment: Production

### Gemini Setup

1. **Get API Key**:
   - Visit https://aistudio.google.com/app/apikey
   - Sign in with Google account
   - Click "Create API Key"
   - Copy the key

2. **Add to Vercel**:
   - Key: `GEMINI_API_KEY`
   - Value: Your Gemini API key
   - Environment: Production

3. **Set Provider**:
   - Key: `AI_PROVIDER`
   - Value: `gemini`
   - Environment: Production

## Automatic Fallback

The system automatically tries a fallback if the primary provider fails:

1. If `AI_PROVIDER=groq` fails → tries fallback
2. If `AI_PROVIDER=gemini` fails → tries fallback
3. If `AI_PROVIDER=fallback` → no fallback (already using it)

## Quick Switch Examples

### Switch from Groq to Gemini

1. Add `GEMINI_API_KEY` to Vercel
2. Set `AI_PROVIDER=gemini` in Vercel
3. Redeploy

### Switch from Gemini to Groq

1. Set `AI_PROVIDER=groq` in Vercel
2. Redeploy
3. (Keep `GEMINI_API_KEY` if you want to switch back later)

### Temporarily Disable AI

1. Set `AI_PROVIDER=fallback` in Vercel
2. Redeploy
3. Users will see: "AI recommendation service is unavailable"

## Troubleshooting

### "AI_PROVIDER not set"
- **Solution**: Add `AI_PROVIDER` environment variable (defaults to `groq`)

### "GEMINI_API_KEY not set" (when using Gemini)
- **Solution**: Add `GEMINI_API_KEY` to Vercel environment variables

### "GROQ_API_KEY not set" (when using Groq)
- **Solution**: Add `GROQ_API_KEY` to Vercel environment variables

### Provider keeps failing
- Check Vercel logs for specific error messages
- Verify API key is correct
- Check provider status/rate limits
- Try switching to the other provider

## Cost Comparison

| Provider | Free Tier | Paid Tier |
|----------|-----------|-----------|
| **Groq** | Generous free tier | Pay as you go |
| **Gemini** | 60 req/min free | $0.000125 per 1K tokens |
| **Fallback** | Free (no AI) | N/A |

## Recommendation

- **Start with Groq**: Fast, free, easy setup
- **Use Gemini as backup**: If Groq has issues, switch to Gemini
- **Keep both API keys**: Set both in Vercel, switch providers as needed

## Code Structure

The abstraction layer is in:
- `lib/ai-provider.ts` - Main abstraction
- `lib/groq.ts` - Groq implementation
- `lib/gemini.ts` - Gemini implementation

To add a new provider:
1. Create `lib/[provider].ts` with the same interface
2. Add it to `ai-provider.ts` switch statement
3. Update this documentation
