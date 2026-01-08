# VibeWatch MVP Implementation Summary

## Overview
This document summarizes the comprehensive refactoring to implement guest participation, participant-based voting, and improved decision session logic.

## Database Changes

### New Schema
1. **GroupParticipant Table**: Unified model for both members (logged-in users) and guests
   - `type`: 'member' | 'guest'
   - `user_id`: nullable (null for guests)
   - `preferred_name`: required for guests, optional for members
   - `status`: 'active' | 'removed'

2. **Vote Table Updates**: 
   - Changed from `user_id` to `participant_id` (references GroupParticipant)
   - Supports both member and guest votes

3. **DecisionSession Updates**:
   - Added `created_by_user_id`
   - Added `picked_by`: 'consensus' | 'ai' (for debugging, not exposed in UI)
   - Added `alternates_json`: stores alternate movie recommendations

### Migration
Run the migration: `prisma migrate dev` (or apply `prisma/migrations/20250108000000_add_participants/migration.sql` manually)

## API Changes

### New/Updated Endpoints

1. **POST /api/groups/create**
   - Creates GroupParticipant record for host
   - Returns invite link

2. **POST /api/groups/join/[code]**
   - Supports guest join with `preferredName` in body
   - Sets guest session cookie
   - Creates GroupParticipant record

3. **POST /api/groups/[groupId]/guests/[participantId]/remove**
   - Host-only endpoint to remove guests
   - Sets participant status to 'removed'
   - Unblocks round completion if guest was blocking

4. **POST /api/votes/submit**
   - Uses `participant_id` instead of `user_id`
   - Checks round completion after each vote
   - Implements consensus logic: YES >= 2 AND NO == 0
   - Auto-advances rounds or calls Groq final resolution

5. **GET /api/sessions/[sessionId]/status**
   - Returns `participantsStatus` array with completion status
   - Shows green/red dots for each participant

6. **POST /api/sessions/create**
   - Uses vibe text to fetch initial 5 movies (not watchlist)
   - Creates participant record if needed

## Guest Authentication

### Cookie-Based Session
- Guest participants get a signed cookie: `vw_guest_participant`
- Cookie contains participant ID with HMAC signature
- Valid for 30 days
- Utilities in `lib/guest-auth.ts`

### Participant Resolution
- `lib/participant.ts` provides `getCurrentParticipant()`
- Checks Supabase session first (for members)
- Falls back to guest cookie (for guests)

## UI Changes

### Group/Watchlist Page
- Shows participant list with status dots (green = completed, red = not completed)
- "Copy invite link" button
- "Start Decision Session" or "Enter Decision Session" CTA
- Guest removal (X button) for host only

### Guest Join Page
- Prompts for preferred name
- Auto-detects if user is logged in
- Sets guest cookie on join

### Voting Round Page
- Shows participant status list with completion indicators
- Progress bar for own voting (X/5 movies)
- Participant list with green/red dots
- Status messages for waiting/complete

### Results Page
- Ambiguous message: "Tonight's pick is ready"
- Shows selected movie + alternates
- Does not reveal consensus vs AI decision

## Consensus Logic

### For 3-Person Groups
- Consensus = YES votes >= 2 AND NO votes == 0 for the same movie
- If consensus reached → session completes immediately
- If no consensus after round → advance to next round (up to 5 rounds)
- After round 5 → Groq final resolution

### Round Completion
- Round ends when ALL active participants have voted on ALL 5 movies
- "Active" = status='active' (excludes removed guests)
- Round completion triggers consensus check or round advance

## Testing Guide

### Multi-User Testing (1 Host + 2 Guests)

1. **Host Setup**:
   - Log in via magic link
   - Create a group
   - Copy invite link

2. **Guest 1** (Incognito Window 1):
   - Open invite link
   - Enter name (e.g., "Alice")
   - Join as guest
   - Should see group page

3. **Host**:
   - Start decision session
   - Enter vibe text (e.g., "funny comedy")
   - Should see Round 1 with 5 movies

4. **Guest 1** (Incognito Window 1):
   - Click "Enter Decision Session"
   - Should see same Round 1
   - Vote on movies

5. **Guest 2** (Incognito Window 2):
   - Open same invite link
   - Enter name (e.g., "Bob")
   - Join as guest
   - Click "Enter Decision Session"
   - Should see Round 1
   - Vote on movies

6. **All Participants**:
   - Watch participant status dots update
   - When all 3 vote on all 5 movies → round completes
   - If consensus (2+ YES, 0 NO) → results page
   - If no consensus → Round 2 (up to 5 rounds)
   - After Round 5 → Groq final resolution

### Solo Testing
- Create group as logged-in user
- Start decision session
- Vote on all 5 movies
- Round completes immediately
- Groq recommends based on your votes

## Bug Fixes

1. **Watchlist Loading Bug**: Fixed API to use participants instead of members
2. **Round 1 Movie Display**: Ensured round stores tmdb_ids correctly
3. **Invite Flow**: Implemented copy link + guest join with name

## Environment Variables

Add to `.env.local`:
```
GUEST_SESSION_SECRET=your-secret-key-here
```

## Next Steps

1. Run migration: `npx prisma migrate dev`
2. Generate Prisma client: `npx prisma generate`
3. Test with multiple incognito windows
4. Verify guest removal unblocks rounds
5. Test consensus logic with 3 participants

## Notes

- Legacy `GroupMember` table is kept for backward compatibility
- Existing votes are migrated to use `participant_id`
- Guest cookies are signed but not encrypted (sufficient for MVP)
- All vote data remains private (not exposed in API responses)
