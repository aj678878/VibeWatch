# VibeWatch Deployment Guide

## Prerequisites

1. ✅ Code updates completed (environment variables configured)
2. ⏳ Local build test (run `npm run build` to verify)
3. ⏳ Vercel account created
4. ⏳ GitHub repository (optional, but recommended)

## Step-by-Step Deployment

### 1. Test Local Build

Before deploying, test the build locally:

```bash
npm run build
```

If the build succeeds, you're ready to deploy!

### 2. Create Vercel Account & Project

**Option A: Via Vercel Dashboard (Recommended)**
1. Go to https://vercel.com and sign up/login
2. Click "Add New Project"
3. Import your GitHub repository (or use Vercel CLI)
4. Vercel will auto-detect Next.js

**Option B: Via Vercel CLI**
```bash
npm i -g vercel
vercel login
vercel
```

### 3. Configure Environment Variables in Vercel

**Important**: Vercel does NOT allow uploading `.env.local` files. You must manually enter each variable.

1. Go to your Vercel project dashboard
2. Navigate to **Settings → Environment Variables**
3. Click **"Add New"** for each variable
4. Copy the **variable names and values** from your `.env.local` file

**See [VERCEL_ENV_VARS.md](./VERCEL_ENV_VARS.md) for detailed instructions and checklist.**

Required variables to add:
- `DATABASE_URL` (from your `.env.local`)
- `SUPABASE_URL` (from your `.env.local`)
- `SUPABASE_ANON_KEY` (from your `.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL` (from your `.env.local`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from your `.env.local`)
- `TMDB_API_KEY` (from your `.env.local`)
- `GROQ_API_KEY` (from your `.env.local`)
- `NEXT_PUBLIC_APP_URL` (set to your Vercel URL after first deployment)

**Important**: Replace `[your-app]` with your actual Vercel deployment URL after first deployment.

### 4. Update Supabase Redirect URLs

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication → URL Configuration**
4. Under **Redirect URLs**, add:
   - `https://[your-app].vercel.app/auth/callback`
5. Update **Site URL** to:
   - `https://[your-app].vercel.app`
6. Save changes

### 5. Deploy to Vercel

**If using Dashboard:**
- Click "Deploy" button
- Wait for build to complete

**If using CLI:**
```bash
vercel --prod
```

### 6. Update NEXT_PUBLIC_APP_URL

After first deployment, Vercel will give you a URL like `https://vibewatch-xyz.vercel.app`

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Update `NEXT_PUBLIC_APP_URL` to your actual Vercel URL
3. Redeploy (or it will auto-redeploy on next push)

### 7. Run Database Migrations

Vercel will run `prisma generate` automatically during build, but ensure migrations are applied:

**Option A: Via Supabase SQL Editor**
1. Go to Supabase Dashboard → SQL Editor
2. Run the migration SQL from `prisma/migrations/[latest]/migration.sql`

**Option B: Via Prisma Studio (local)**
```bash
npx prisma studio
```
Then verify tables exist.

### 8. Test Production Deployment

1. **Test Authentication:**
   - Visit your Vercel URL
   - Try logging in with magic link
   - Verify redirect works

2. **Test Multi-User:**
   - Create a group with User A
   - Share invite link: `https://[your-app].vercel.app/groups/join/[code]`
   - User B opens link and joins
   - Both users add movies
   - Start decision session
   - Test voting rounds

## Troubleshooting

### Build Fails
- Check Vercel build logs
- Ensure all environment variables are set
- Verify Prisma client generates correctly

### Authentication Errors
- Verify Supabase redirect URLs match exactly (including https://)
- Check that `NEXT_PUBLIC_APP_URL` is set correctly
- Review Supabase logs for auth errors

### Database Connection Errors
- Verify `DATABASE_URL` is correct in Vercel
- Check Supabase project is active
- Ensure database password is correct

### PKCE Errors
- Ensure Supabase redirect URL includes `/auth/callback`
- Verify cookies are working (check browser console)

## Post-Deployment Checklist

- [ ] Magic link authentication works
- [ ] Group creation works
- [ ] Invite links work (shareable URLs)
- [ ] Multiple users can join same group
- [ ] Movie search works
- [ ] Watchlist functionality works
- [ ] Decision sessions work
- [ ] Voting rounds work
- [ ] AI recommendations work
- [ ] Results page displays correctly

## Quick Reference

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Your App URL**: `https://[your-app].vercel.app`
