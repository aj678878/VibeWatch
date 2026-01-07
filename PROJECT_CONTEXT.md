# VibeWatch MVP - Project Context

**Last Updated**: January 2025  
**Purpose**: Single source of truth for VibeWatch MVP behavior, rules, and constraints.

---

## 1. Product Snapshot

**What VibeWatch Is**: VibeWatch is a collaborative movie decision-making product designed to solve the "what should we watch?" problem for small groups (3-6 people). Instead of endless scrolling or awkward majority votes, VibeWatch uses private voting, optional rejection reasons, round-based refinement, and AI-assisted final resolution to create a fair, low-friction way for groups to arrive at a movie choice—even when preferences conflict.

**MVP Scope**: This MVP focuses exclusively on the Group Watch feature. It includes: magic link authentication, group creation/joining via invite links, collaborative watchlist building, structured voting rounds (max 5), consensus detection, and AI-assisted final recommendations. The MVP does NOT include: individual recommendation engines, personal watchlists, friend graphs, user profiles, chat/discussion features, timers, or real-time syncing beyond basic polling.

**Out of Scope for MVP**: Individual movie recommendations, personal watchlists, friend/social features, chat or discussion UI, timers or countdowns, real-time WebSocket syncing, movie data caching in database, user profiles beyond Supabase Auth, local ML models, public vote counts or tallies, revealing consensus vs AI resolution method.

---

## 2. Non-Negotiables (Hard Rules)

**These rules must NEVER be violated:**

- [ ] **Votes are private**: No user can see how others voted. No vote counts, tallies, or "X people voted YES" displays anywhere in the UI.
- [ ] **Results are ambiguous**: The results page never reveals whether the outcome came from consensus or AI recommendation. Message is always: "Tonight's pick is ready" (same message regardless of source).
- [ ] **Max 5 rounds**: A decision session cannot exceed 5 voting rounds. After round 5, if no consensus, trigger final AI resolution.
- [ ] **AI can recommend unseen movies**: The final AI resolution can recommend movies that were NOT shown in any voting round.
- [ ] **Minimal movie storage**: Store only `tmdb_id` in database. Fetch full movie details from TMDB API on-demand. No `movies` cache table.
- [ ] **No user table**: Supabase Auth handles all user management. No custom `users` table. User IDs are Supabase UUIDs.
- [ ] **Rejection reasons are optional**: Users can vote NO without providing a reason. The UI never forces users to enter rejection reasons.
- [ ] **NO votes don't block consensus**: A NO vote does not prevent consensus. Only YES votes determine consensus. NO votes are used only as preference signals for AI refinement.
- [ ] **Polling-based updates**: Use polling (every 2-3 seconds) for session status updates. No WebSocket or real-time complexity.
- [ ] **No timers**: Rounds are not time-limited. Progress happens when all members complete voting.
- [ ] **No discussion UI**: No chat, comments, or public discussion features during voting.

---

## 3. Definitions

**Group**: A collection of users who can collaboratively build a watchlist and run decision sessions. Created by one user, joined by others via invite link. Identified by a unique `invite_code` (8-character lowercase alphanumeric).

**Group Watchlist**: A list of movies (stored as `tmdb_id` values) associated with a group. Members can add movies via TMDB search. Used as a pool for decision sessions.

**Decision Session**: A single attempt by a group to choose a movie. Includes: vibe text (user-entered description), status (active/completed), current round number (1-5), and optional final movie selection. A group can have only one active session at a time.

**Voting Round**: One iteration within a decision session where exactly 5 movies are presented to all members. Each member votes YES or NO on each movie. Rounds are numbered 1-5.

**Candidate Set**: The 5 movies shown in a voting round. Stored as an array of `tmdb_id` values in the `voting_rounds` table. Same set shown to all members simultaneously.

**Vote**: A user's response to a movie in a round. Either "yes" or "no". Stored per user, per movie, per round. Votes are private—only the voting user can see their own votes.

**Rejection Reason**: Optional text field associated with a NO vote. Users can provide a reason (e.g., "too slow", "don't want subtitles") but it is never mandatory. Stored as `reason_text` (nullable) in the `votes` table.

**Consensus**: A decision rule that ends a session early. For 3-person groups: consensus = at least 2 YES votes on the same movie in a round. NO votes do NOT block consensus. If consensus is reached, the session completes immediately with that movie as the final selection.

**Final Resolution**: The AI-assisted step that runs after 5 rounds if no consensus was reached. Groq analyzes all voting history and recommends 1 top pick + 2 alternates. Can recommend movies not previously shown. The UI presents this identically to consensus outcomes (ambiguous).

**Ambiguous Outcome UI**: The results page design that never reveals whether the final movie came from consensus or AI recommendation. Always shows: "Tonight's pick is ready" with the movie, alternates, and explanation—without indicating the resolution method.

---

## 4. User Journeys (Step-by-Step)

### A. Authentication (Magic Link)

1. User visits `/login`
2. User enters email address
3. System sends magic link email via Supabase Auth
4. User clicks link in email
5. Link redirects to `/auth/callback?code=...`
6. Callback route exchanges code for session, sets cookies
7. User redirected to `/groups`

**Data Created**: Supabase Auth user record (if new user). No custom user table entry.

---

### B. Create Group

1. User clicks "Create Group" from `/groups` page
2. System generates unique 8-character invite code (nanoid, lowercase)
3. System creates `Group` record with `invite_code` and `created_by_user_id`
4. System creates `GroupMember` record linking creator to group
5. User redirected to `/groups/[groupId]/watchlist`

**Data Created**: 1 `Group` record, 1 `GroupMember` record.

---

### C. Join Group via Invite Link

1. User receives invite link: `/groups/join/[code]`
2. User opens link (must be logged in via middleware)
3. System looks up group by `invite_code`
4. System checks if user is already a member
5. If not a member, creates `GroupMember` record
6. User redirected to `/groups/[groupId]/watchlist`

**Data Created**: 1 `GroupMember` record (if user is new to group).

---

### D. Add Movies to Group Watchlist

1. User on watchlist page types in movie search box
2. System queries TMDB API (debounced, 300ms delay)
3. Results displayed with poster, title, overview, year, rating
4. User clicks "Add" on a movie
5. System stores `tmdb_id` in `group_watchlist` table (no full movie data)
6. Movie appears in watchlist (details fetched from TMDB on-demand for display)

**Data Created**: 1 `GroupWatchlist` record per movie added. No movie detail caching.

---

### E. Start a Decision Session

1. User clicks "Start Decision" button (requires at least 5 movies in watchlist)
2. User navigates to `/groups/[groupId]/sessions/new`
3. User enters vibe text (mandatory, free text, e.g., "funny, light, under 2 hours, English")
4. System creates `DecisionSession` record with `status='active'`, `current_round=1`
5. System selects 5 random movies from watchlist for first round
6. System creates `VotingRound` record (round_number=1) with 5 `tmdb_id` values
7. User redirected to `/groups/[groupId]/sessions/[sessionId]/round/1`

**Data Created**: 1 `DecisionSession` record, 1 `VotingRound` record.

---

### F. Round-Based Voting Flow

1. User sees 5 movie cards (details fetched from TMDB on-demand)
2. For each movie, user clicks "Yes" or "No"
3. If "No" clicked, optional reason text field appears (user can skip)
4. User submits vote (can update vote before round completes)
5. System stores/updates `Vote` record (private, not visible to others)
6. UI shows user's own votes (highlighted Yes/No state)
7. Polling checks every 3 seconds if all members have voted
8. When all members voted on all 5 movies, system checks for consensus

**Data Created**: Up to 5 `Vote` records per user per round (one per movie).

**Privacy Rules**: 
- User only sees their own votes
- No indication of how others voted
- No "3 of 5 voted" indicators
- No vote counts displayed

---

### G. Consensus Detection and Round Transitions

1. After all members vote on all 5 movies in a round:
2. System counts YES votes per movie
3. For 3-person groups: If any movie has ≥2 YES votes → consensus reached
4. If consensus: Set `DecisionSession.status='completed'`, store `final_movie_tmdb_id`, redirect to results
5. If no consensus and `current_round < 5`:
   - Call Groq to extract preferences from votes + reasons
   - Groq returns constraints (genres, runtime, tone, avoid list)
   - System queries TMDB with constraints (or uses watchlist if enough movies)
   - Select 5 diverse movies for next round (avoid duplicates from previous rounds)
   - Create new `VotingRound` record, increment `current_round`
   - Redirect users to next round page
6. If no consensus and `current_round = 5`:
   - Trigger final AI resolution (see Journey H)

**Data Created**: New `VotingRound` records for rounds 2-5 if needed.

---

### H. Final Resolution After 5 Rounds

1. System calls Groq with: vibe text, all votes from all rounds, all rejection reasons, round history
2. Groq analyzes patterns and recommends:
   - 1 top pick (`tmdb_id`, title, reason)
   - 2 alternates (`tmdb_id`, title, reason each)
   - Fairness explanation (why this choice, what preferences it satisfies)
3. System sets `DecisionSession.status='completed'`, stores `final_movie_tmdb_id`
4. All users redirected to `/groups/[groupId]/sessions/[sessionId]/results`
5. Results page shows: "Tonight's pick is ready" (ambiguous message)
6. Displays: movie poster, title, overview, alternates, explanation
7. UI never reveals whether this was consensus or AI-selected

**Data Created**: `DecisionSession` updated with final movie. No separate "resolution" table.

---

## 5. Consensus Logic (Very Explicit)

### For 3-Person Groups (MVP Focus)

**Consensus Rule**: A movie is selected if **at least 2 users vote YES on the same movie** in a round.

**Important**: NO votes do NOT block consensus. If Movie A has 2 YES votes and 1 NO vote, consensus is still reached on Movie A.

**Computation Steps**:
1. After all members have voted on all 5 movies in a round
2. For each movie in the round, count YES votes: `count_yes = votes.filter(v => v.vote === 'yes' && v.movie_tmdb_id === movie_id).length`
3. If `count_yes >= 2` for any movie → consensus reached on that movie
4. Use the first movie that meets the threshold (if multiple movies have ≥2 YES, pick the first one found)

### Round Completion Rules

**"Round Complete" Definition**: A round is complete when **all members of the group have voted on all 5 movies** in that round.

**What if a user doesn't vote?**: 
- The round does not progress until all members vote
- No timeouts or automatic progression
- Polling continues until all votes are in
- UI shows "Waiting for other members..." when user has voted but others haven't

### Handling Groups Larger Than 3 (MVP Fallback)

**For groups with 4+ members**: Use the same rule scaled: consensus = at least `Math.ceil(group_size / 2)` YES votes on the same movie.

Examples:
- 4 members: consensus = 2+ YES votes
- 5 members: consensus = 3+ YES votes  
- 6 members: consensus = 3+ YES votes

**Note**: MVP is optimized for 3-person groups. Larger groups may have different dynamics, but the rule scales proportionally.

---

## 6. Round Mechanics (Very Explicit)

### Initial Round (Round 1) Movie Selection

1. User enters vibe text (e.g., "funny, light, under 2 hours")
2. System selects 5 random movies from the group watchlist
3. No AI involvement for round 1 (simple random selection from watchlist)
4. If watchlist has <5 movies, session cannot start (enforced in UI)

**Diversity**: Random selection naturally provides some diversity. No explicit genre/runtime filtering for round 1.

### Subsequent Rounds (2-5) Movie Selection

1. After round completes (all votes in, no consensus):
2. System calls Groq with:
   - Vibe text
   - Current round votes (YES/NO + optional reasons)
   - All previous round votes and reasons
   - Round history (which movies were shown)
3. Groq extracts structured preferences:
   - Genres to favor (from YES votes)
   - Genres/runtime/tone to avoid (from NO votes + reasons)
   - Constraints (runtime min/max, language, year range if inferred)
4. System uses preferences to:
   - Filter watchlist movies (if enough available)
   - Or search TMDB with genre/runtime filters
   - Select 5 diverse movies
5. Diversity constraints:
   - Avoid movies already shown in previous rounds
   - Prefer different genres if possible
   - Balance between YES vote patterns and avoiding NO vote patterns

**Data Carried Forward**: All votes (YES/NO), all rejection reasons (if provided), vibe text, round history (which movies were shown).

### Max Rounds = 5

- Round 1: Initial selection from watchlist
- Rounds 2-5: AI-assisted refinement
- After round 5: If no consensus → final AI resolution (see Journey H)

---

## 7. "Reasons for No" Policy

**Mandatory or Optional?**: **OPTIONAL**. Users can vote NO without providing a reason. The UI never forces users to enter rejection reasons.

**UI Pattern**: 
- User clicks "No" on a movie
- Optional text field appears: "Optional: Why not this one? (e.g., too slow, don't want subtitles)"
- User can:
  - Enter a reason and submit
  - Skip the reason and submit NO vote directly
  - Cancel and change their mind

**Storage**: Stored as `reason_text` (nullable string) in `votes` table. Only stored if user provides it.

**How AI Uses It**: 
- Groq analyzes rejection reasons to infer constraints (e.g., "too slow" → prefer shorter runtime, "don't want subtitles" → prefer English language)
- Reasons are used as preference signals, not hard blockers
- If no reasons provided, AI relies on YES vote patterns and vibe text

---

## 8. AI Responsibilities (Groq) and Guardrails

### Stage 1: Preference Extraction (After Each Round)

**What Groq Does**: Analyzes votes + optional reasons to extract structured constraints.

**Input**: Vibe text, current round votes, round history, optional rejection reasons.

**Output**: Structured JSON with:
- `genres`: Array of preferred genres (or null)
- `runtime`: `{min, max}` in minutes (or null)
- `language`: Preferred language code (or null)
- `tone`: Array of tone descriptors (or null)
- `avoid`: Array of things to avoid (or null)
- `year`: `{min, max}` year range (or null)

**Guardrails**: 
- Only infer constraints that are confidently extractable
- Use null if uncertain
- Don't output user-specific data (no user IDs, no vote counts per user)

### Stage 2: Next Round Shaping (Rounds 2-5)

**What Groq Does**: Uses extracted preferences to guide movie selection for next round.

**Input**: Preference constraints from Stage 1, watchlist `tmdb_id` array, previously shown movies.

**Output**: Guidance for which movies to select (implementation may use constraints to filter TMDB or watchlist).

**Guardrails**:
- Don't reveal which user voted what
- Don't output movies that were strongly rejected (use "avoid" list)
- Ensure diversity (don't recommend 5 similar movies)

### Stage 3: Final Resolution (After Round 5)

**What Groq Does**: Recommends final movie choice + alternates with fairness explanation.

**Input**: Vibe text, all votes from all 5 rounds, all rejection reasons, round history, watchlist.

**Output**: Structured JSON:
```json
{
  "topPick": {
    "tmdb_id": 123,
    "title": "Movie Title",
    "reason": "Brief explanation"
  },
  "alternates": [
    {"tmdb_id": 456, "title": "Movie 2", "reason": "..."},
    {"tmdb_id": 789, "title": "Movie 3", "reason": "..."}
  ],
  "explanation": "Overall fairness explanation"
}
```

**Guardrails**:
- Can recommend movies NOT in watchlist (if they better match preferences)
- Must provide valid TMDB IDs (not invented movies)
- Explanation must be fair and balanced (don't favor one user's preferences)
- Don't reveal voting patterns or consensus status
- Avoid movies that were strongly rejected (multiple NO votes with reasons)

**Fairness Principles**:
- Balance all users' preferences (don't ignore minority preferences)
- Minimize strong objections (avoid movies with clear rejection reasons)
- Respect vibe text constraints
- Consider runtime, language, tone if inferred
- Provide alternates for flexibility

---

## 9. Data Model Expectations (High-Level Contract)

### Core Tables

**`groups`**:
- Stores group metadata: `id`, `invite_code` (unique), `created_by_user_id` (Supabase UUID), `created_at`
- No user table—Supabase Auth handles users

**`group_members`**:
- Links users to groups: `user_id` (Supabase UUID), `group_id`, `joined_at`
- Unique constraint on `(user_id, group_id)`

**`group_watchlists`**:
- Stores movies in watchlist: `group_id`, `tmdb_id` (integer), `id` (primary key)
- Unique constraint on `(group_id, tmdb_id)`
- **No full movie data stored**—only TMDB ID

**`decision_sessions`**:
- Stores session state: `id`, `group_id`, `vibe_text`, `status` ('active'/'completed'), `current_round` (1-5), `final_movie_tmdb_id` (nullable), `created_at`
- Only one active session per group at a time

**`voting_rounds`**:
- Stores round data: `id`, `session_id`, `round_number` (1-5), `movie_tmdb_ids` (JSON array of integers)
- Unique constraint on `(session_id, round_number)`

**`votes`**:
- Stores individual votes: `id`, `round_id`, `user_id` (Supabase UUID), `movie_tmdb_id`, `vote` ('yes'/'no'), `reason_text` (nullable string)
- Unique constraint on `(round_id, user_id, movie_tmdb_id)`
- **Private data**—never exposed in API responses showing other users' votes

### Data Fetching Strategy

**Movies**: Fetch full details from TMDB API on-demand using `tmdb_id`. Cache in React state during session, but don't persist to database.

**Users**: Supabase Auth provides user data. No custom user table. Use Supabase UUIDs as foreign keys.

---

## 10. API Expectations (High-Level)

### Authentication

**`GET /auth/callback`**:
- Input: `code` query parameter (from Supabase magic link)
- Output: Redirect to `/groups` or `/login` with error
- Never returns: User session data in response body

### Groups

**`POST /api/groups/create`**:
- Input: None (user from session)
- Output: `{ group: { id, invite_code, ... } }`
- Never returns: Other users' data

**`POST /api/groups/join/[code]`**:
- Input: `code` in URL
- Output: `{ group: { id, ... } }`
- Never returns: Other members' user IDs or emails

**`GET /api/groups/[groupId]/watchlist`**:
- Input: `groupId` in URL
- Output: `{ watchlist: [{ id, tmdb_id }, ...] }`
- Never returns: Full movie data (fetch from TMDB on client)

**`POST /api/groups/[groupId]/watchlist/[tmdbId]`**:
- Input: `groupId`, `tmdbId` in URL
- Output: `{ success: true }`
- Never returns: Error details exposing other users' actions

**`DELETE /api/groups/[groupId]/watchlist/[tmdbId]`**:
- Input: `groupId`, `tmdbId` in URL
- Output: `{ success: true }`

### Decision Sessions

**`POST /api/sessions/create`**:
- Input: `{ groupId, vibeText }`
- Output: `{ session: { id, ... } }`
- Never returns: Other sessions' data

**`GET /api/sessions/[sessionId]/status`**:
- Input: `sessionId` in URL
- Output: `{ session: {...}, currentRound: {...}, userVotes: [...], hasVotedOnAll: boolean }`
- **Critical**: `userVotes` only contains the requesting user's votes. Never returns other users' votes.

**`POST /api/votes/submit`**:
- Input: `{ roundId, movieTmdbId, vote, reasonText? }`
- Output: `{ success: true }`
- Never returns: Other users' votes or vote counts

**`POST /api/sessions/[sessionId]/next-round`**:
- Input: `sessionId` in URL
- Output: `{ consensus: boolean, final_movie_tmdb_id?, nextRound?, movies? }`
- Never returns: Vote breakdowns or who voted what

**`POST /api/sessions/[sessionId]/refine`**:
- Input: `sessionId` in URL
- Output: `{ success: true, nextRound: number, movies: [tmdb_id, ...] }`
- Internal endpoint (called by next-round logic)

**`POST /api/sessions/[sessionId]/final-resolution`**:
- Input: `sessionId` in URL
- Output: `{ success: true, recommendation: { topPick, alternates, explanation } }`
- Never returns: Voting patterns or consensus status

### TMDB Proxy

**`GET /api/tmdb/search?q=...`**:
- Input: `q` query parameter
- Output: TMDB search results (title, poster, overview, etc.)
- Never caches results in database

**`GET /api/tmdb/movie/[id]`**:
- Input: `id` in URL (tmdb_id)
- Output: Full TMDB movie details
- Never caches results in database

---

## 11. UI/Design System Principles

**Visual Style**:
- Dark theme (black/gray-900 background)
- Glassmorphic elements (backdrop-blur, white/5-10 opacity, border white/10)
- Muted gradients (gray-900 via black to gray-900)
- Thin typography (font-light, 300 weight)
- Premium, calm aesthetic (no gamification, no bright colors)

**Interaction Principles**:
- Reduce social friction (private votes, no pressure)
- Hide individual actions (no "X added a movie" notifications)
- Encourage honest rejection (optional reasons, no judgment)
- Keep momentum high (clear CTAs, minimal steps)
- Avoid overwhelming choices (5 movies max per round)

**Component Patterns**:
- Glass cards for content sections
- Subtle hover states
- Disabled states for incomplete actions
- Loading states for async operations
- Error states with clear messages (no technical jargon)

**Group Mode Emphasis**:
- Privacy indicators (subtle, not prominent)
- Low-friction flows (minimal clicks)
- Clear status ("Waiting for other members...")
- Ambiguous outcomes (never reveal method)

---

## 12. "DO NOT CHANGE" List

**Critical Rules That Must Never Be Violated**:

- ❌ **DO NOT** add screens, components, or API endpoints that reveal vote counts, tallies, or who voted what
- ❌ **DO NOT** add a "Consensus Achieved" banner or any indicator that reveals the resolution method
- ❌ **DO NOT** change the max rounds limit (5) without updating this document and all related logic
- ❌ **DO NOT** change the ambiguity principle on the results page—it must always say "Tonight's pick is ready" regardless of source
- ❌ **DO NOT** make rejection reasons mandatory—they must remain optional
- ❌ **DO NOT** add a movies cache table—always fetch from TMDB on-demand
- ❌ **DO NOT** add real-time WebSocket syncing—use polling only
- ❌ **DO NOT** add timers or countdowns to voting rounds
- ❌ **DO NOT** add chat, comments, or discussion features
- ❌ **DO NOT** change consensus logic to require unanimous YES votes—2+ YES is sufficient for 3-person groups
- ❌ **DO NOT** allow NO votes to block consensus—they are preference signals only
- ❌ **DO NOT** expose other users' votes in any API response
- ❌ **DO NOT** add user profiles, friend graphs, or social features
- ❌ **DO NOT** change the voting privacy model—votes must remain private

---

## 13. Testing Checklist (MVP)

**Authentication**:
- [ ] Magic link email sends successfully
- [ ] Clicking magic link redirects to app and logs user in
- [ ] Logged-in users can access protected routes
- [ ] Logged-out users are redirected to login

**Group Management**:
- [ ] User can create a group and receives invite code
- [ ] Invite code is unique and 8 characters
- [ ] User can join group via invite link (`/groups/join/[code]`)
- [ ] User cannot join same group twice (idempotent)
- [ ] Group members list updates when new members join

**Watchlist**:
- [ ] Movie search returns results from TMDB
- [ ] User can add movie to watchlist (stores only tmdb_id)
- [ ] Watchlist displays movies (fetches details from TMDB on-demand)
- [ ] User can remove movie from watchlist
- [ ] Multiple users can add movies to same watchlist
- [ ] Watchlist requires at least 5 movies to start decision session

**Decision Sessions**:
- [ ] User can start session with vibe text
- [ ] Session creates with 5 random movies from watchlist
- [ ] Session status is 'active' initially
- [ ] Only one active session per group at a time

**Voting Rounds**:
- [ ] All members see the same 5 movies in a round
- [ ] User can vote YES or NO on each movie
- [ ] User can provide optional rejection reason for NO votes
- [ ] User can update their vote before round completes
- [ ] User only sees their own votes (privacy maintained)
- [ ] Round completes when all members vote on all 5 movies
- [ ] Polling updates session status every 3 seconds

**Consensus Detection**:
- [ ] Consensus triggers when 2+ users vote YES on same movie (3-person group)
- [ ] NO votes do not block consensus
- [ ] Session completes immediately when consensus reached
- [ ] Final movie is stored in `decision_sessions.final_movie_tmdb_id`

**Round Progression**:
- [ ] If no consensus, next round is generated with AI assistance
- [ ] Next round shows 5 different movies (not duplicates from previous rounds)
- [ ] Rounds progress from 1 to 5 maximum
- [ ] After round 5, if no consensus, final AI resolution triggers

**Final Resolution**:
- [ ] Groq is called after round 5 if no consensus
- [ ] AI recommends 1 top pick + 2 alternates
- [ ] AI can recommend movies not shown in rounds
- [ ] Results page shows ambiguous message ("Tonight's pick is ready")
- [ ] Results page never reveals consensus vs AI
- [ ] Results show movie, alternates, and explanation

**Multi-User Testing**:
- [ ] User A creates group, gets invite code
- [ ] User B joins via invite link
- [ ] Both users can add movies to watchlist
- [ ] Both users can start/participate in decision session
- [ ] Both users vote independently (votes are private)
- [ ] Both users see round progression simultaneously (via polling)
- [ ] Both users see same results page when session completes

**API Security**:
- [ ] No API endpoint returns other users' votes
- [ ] No API endpoint returns vote counts or tallies
- [ ] Session status endpoint only returns requesting user's votes
- [ ] All protected routes require authentication

**Data Integrity**:
- [ ] Movie details are fetched from TMDB, not cached in DB
- [ ] Only tmdb_id stored in watchlist/rounds/votes tables
- [ ] User IDs are Supabase UUIDs (no custom user table)
- [ ] Database constraints prevent duplicate votes per user per movie per round

---

## Implementation Stack Reference

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Authentication**: Supabase Auth (magic links)
- **Movie Data**: TMDB API (on-demand fetching)
- **AI**: Groq API (preference extraction, recommendations)
- **State Updates**: Polling (2-3 second intervals)
- **Deployment**: Vercel (recommended)

---

**End of Document**
