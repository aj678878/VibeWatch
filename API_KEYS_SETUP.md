# API Keys Setup Guide

## ⚠️ IMPORTANT: Never Add API Keys in Code!

**DO NOT** hardcode API keys in your code files. Always use environment variables.

## Where to Add API Keys

### For Local Development

Add to `.env.local` file in your project root:

```bash
# Groq API Key (for AI recommendations)
GROQ_API_KEY=your-groq-api-key-here

# Gemini API Key (optional, alternative to Groq)
GEMINI_API_KEY=your-gemini-api-key-here

# AI Provider (optional, defaults to 'groq')
AI_PROVIDER=groq
# or
# AI_PROVIDER=gemini
```

**Important**: 
- `.env.local` is already in `.gitignore` - it won't be committed to Git
- Never commit `.env.local` to version control
- Create `.env.local` if it doesn't exist

### For Production (Vercel)

Add to **Vercel Environment Variables**:

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Click **"Add New"**
5. Add each variable:

   **For Groq:**
   - Key: `GROQ_API_KEY`
   - Value: Your Groq API key
   - Environment: **Production** (and Preview if needed)

   **For Gemini (optional):**
   - Key: `GEMINI_API_KEY`
   - Value: Your Gemini API key
   - Environment: **Production** (and Preview if needed)

   **To Switch Providers:**
   - Key: `AI_PROVIDER`
   - Value: `groq` or `gemini`
   - Environment: **Production** (and Preview if needed)

6. Click **"Save"**
7. **Redeploy** your project (Vercel will prompt you)

## How the Code Reads API Keys

The code automatically reads from environment variables:

```typescript
// ✅ CORRECT - Reads from environment variable
const apiKey = process.env.GROQ_API_KEY

// ❌ WRONG - Never do this!
const apiKey = "gsk_1234567890abcdef"
```

## Verify API Keys Are Set

### Local Development

Check your `.env.local` file exists and has the keys:
```bash
cat .env.local
```

### Production (Vercel)

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. You should see `GROQ_API_KEY` listed (value is hidden for security)
3. Check build logs for warnings like:
   - `WARNING: GROQ_API_KEY environment variable is not set!` ← This means it's NOT set
   - No warning = API key is set correctly

## Getting API Keys

### Groq API Key

1. Visit https://console.groq.com/
2. Sign up/login
3. Go to **API Keys** section
4. Click **"Create API Key"**
5. Copy the key (you'll only see it once!)

### Gemini API Key

1. Visit https://aistudio.google.com/app/apikey
2. Sign in with Google account
3. Click **"Create API Key"**
4. Copy the key

## Quick Checklist

### Local Development:
- [ ] Create `.env.local` file in project root
- [ ] Add `GROQ_API_KEY=your-key-here`
- [ ] (Optional) Add `GEMINI_API_KEY=your-key-here`
- [ ] (Optional) Add `AI_PROVIDER=groq` or `gemini`
- [ ] Restart your dev server (`npm run dev`)

### Production (Vercel):
- [ ] Get Groq API key from https://console.groq.com/
- [ ] Go to Vercel → Settings → Environment Variables
- [ ] Add `GROQ_API_KEY` with your key
- [ ] (Optional) Add `GEMINI_API_KEY` if using Gemini
- [ ] (Optional) Add `AI_PROVIDER` to switch providers
- [ ] Redeploy your project

## Security Best Practices

✅ **DO:**
- Store API keys in environment variables
- Use `.env.local` for local development (already in `.gitignore`)
- Add keys to Vercel environment variables for production
- Keep API keys secret and never share them

❌ **DON'T:**
- Hardcode API keys in `.ts` or `.tsx` files
- Commit `.env.local` to Git (it's already ignored)
- Share API keys in screenshots or messages
- Add API keys to public files

## Troubleshooting

### "API key not set" Error

**Local:**
- Check `.env.local` exists in project root
- Verify the key name is exactly `GROQ_API_KEY` (case-sensitive)
- Restart your dev server after adding keys

**Production:**
- Check Vercel environment variables are set
- Verify key name is exactly `GROQ_API_KEY` (case-sensitive)
- Redeploy after adding/updating keys

### API Key Not Working

- Verify the key is correct (no extra spaces)
- Check if the key has expired or been revoked
- Try creating a new API key
- Check provider status/rate limits

## Example `.env.local` File

```bash
# Database
DATABASE_URL=your-database-url

# Supabase
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-key
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key

# TMDB
TMDB_API_KEY=your-tmdb-key

# AI Providers
GROQ_API_KEY=gsk_your-groq-key-here
GEMINI_API_KEY=your-gemini-key-here
AI_PROVIDER=groq

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Note**: Replace all `your-*-key-here` with actual keys!
