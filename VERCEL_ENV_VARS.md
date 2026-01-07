# Vercel Environment Variables Reference

## Important: Manual Entry Required

Vercel does **NOT** allow uploading `.env.local` files directly for security reasons. You must manually enter each variable in the Vercel dashboard.

## Step-by-Step: Adding Environment Variables to Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings → Environment Variables**
3. Click **"Add New"** for each variable below
4. Copy the values from your `.env.local` file

## Required Environment Variables

Copy these **exact variable names** and their **values from your `.env.local`**:

### 1. Database Connection
```
DATABASE_URL
```
Value: Your Supabase PostgreSQL connection string from `.env.local`

### 2. Supabase Server-side
```
SUPABASE_URL
SUPABASE_ANON_KEY
```
Values: From your `.env.local` file

### 3. Supabase Client-side (Required - must have NEXT_PUBLIC_ prefix)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```
Values: Same as above (copy from `.env.local`)

### 4. External APIs
```
TMDB_API_KEY
GROQ_API_KEY
```
Values: From your `.env.local` file

### 5. App URL (Update AFTER first deployment)
```
NEXT_PUBLIC_APP_URL
```
**Important**: 
- For first deployment, you can use: `https://your-app-name.vercel.app` (replace with your actual Vercel URL)
- Or leave it empty for first deploy, then update after you get your Vercel URL
- After deployment, Vercel will give you a URL like `https://vibewatch-xyz123.vercel.app`
- Update this variable with your actual URL, then redeploy

## Quick Copy Checklist

From your `.env.local` file, copy these values:

- [ ] `DATABASE_URL` → Paste into Vercel
- [ ] `SUPABASE_URL` → Paste into Vercel  
- [ ] `SUPABASE_ANON_KEY` → Paste into Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_URL` → Paste into Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Paste into Vercel
- [ ] `TMDB_API_KEY` → Paste into Vercel
- [ ] `GROQ_API_KEY` → Paste into Vercel
- [ ] `NEXT_PUBLIC_APP_URL` → Set to your Vercel URL (after first deploy)

## Environment-Specific Settings

In Vercel, you can set variables for:
- **Production** (required)
- **Preview** (optional - for PR previews)
- **Development** (optional - for local dev)

For MVP, set all variables for **Production** environment.

## After Setting Variables

1. Save all variables
2. Redeploy your project (or it will auto-redeploy)
3. Verify variables are loaded (check Vercel build logs)
