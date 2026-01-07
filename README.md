# VibeWatch MVP

A collaborative movie decision-making product for groups.

## Local Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.local.example` to `.env.local` and fill in your credentials.

3. Set up Prisma:
```bash
npx prisma generate
npx prisma migrate dev
```

4. Run the development server:
```bash
npm run dev
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions to Vercel.

Quick deployment steps:
1. Test build: `npm run build`
2. Create Vercel project
3. Set environment variables in Vercel
4. Update Supabase redirect URLs
5. Deploy!

## Tech Stack

- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- Prisma + PostgreSQL (Supabase)
- Supabase Auth
- TMDB API
- Groq API
