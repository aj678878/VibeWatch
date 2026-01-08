# Database Migration Guide

## Issue
The `GroupParticipant` table doesn't exist in production. You need to run the migration.

## Option 1: Run Migration Locally (Recommended)

1. **Get your production DATABASE_URL** from Vercel:
   - Go to your Vercel project → Settings → Environment Variables
   - Copy the `DATABASE_URL` value

2. **Run the migration locally**:
   ```bash
   # Set production DATABASE_URL temporarily
   export DATABASE_URL="your-production-database-url-here"
   
   # Run migrations
   npx prisma migrate deploy
   ```

   Or use Prisma Studio to verify:
   ```bash
   npx prisma studio
   ```

## Option 2: Run Migration via Vercel CLI

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Pull environment variables**:
   ```bash
   vercel env pull .env.production
   ```

3. **Run migration**:
   ```bash
   DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d '=' -f2) npx prisma migrate deploy
   ```

## Option 3: Use Supabase Dashboard (If using Supabase)

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `prisma/migrations/20250108000000_add_participants/migration.sql`
4. Paste and run it in the SQL Editor

## Option 4: Add Migration to Build Process

Add this to your `package.json` scripts:
```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

**Note**: This will run migrations on every build, which is safe for `migrate deploy` (it only runs pending migrations).

## Verify Migration

After running the migration, verify the table exists:
```bash
npx prisma studio
# Or check via SQL:
# SELECT * FROM "GroupParticipant" LIMIT 1;
```

## Important Notes

- **Backup your database** before running migrations in production
- The migration will:
  - Create `GroupParticipant` table
  - Migrate existing `GroupMember` records to `GroupParticipant`
  - Update `Vote` table to use `participant_id` instead of `user_id`
  - Add new fields to `DecisionSession` table

## Troubleshooting

If you get errors about existing data:
- The migration includes `ON CONFLICT DO NOTHING` and `IF NOT EXISTS` clauses
- It should be safe to run multiple times
- If issues persist, check the migration SQL file and run it manually in your database
