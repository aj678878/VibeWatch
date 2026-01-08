-- CreateTable: GroupParticipant
CREATE TABLE "GroupParticipant" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "user_id" TEXT,
    "preferred_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupParticipant_group_id_idx" ON "GroupParticipant"("group_id");
CREATE INDEX "GroupParticipant_user_id_idx" ON "GroupParticipant"("user_id");
CREATE INDEX "GroupParticipant_status_idx" ON "GroupParticipant"("status");
CREATE INDEX "GroupParticipant_type_idx" ON "GroupParticipant"("type");

-- AddForeignKey
ALTER TABLE "GroupParticipant" ADD CONSTRAINT "GroupParticipant_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add new fields to DecisionSession
ALTER TABLE "DecisionSession" ADD COLUMN IF NOT EXISTS "created_by_user_id" TEXT;
ALTER TABLE "DecisionSession" ADD COLUMN IF NOT EXISTS "picked_by" TEXT;
ALTER TABLE "DecisionSession" ADD COLUMN IF NOT EXISTS "alternates_json" JSONB;

-- Migrate existing GroupMembers to GroupParticipants
INSERT INTO "GroupParticipant" ("id", "group_id", "type", "user_id", "preferred_name", "status", "created_at")
SELECT 
    gen_random_uuid()::text,
    gm."group_id",
    'member',
    gm."user_id",
    'Member',
    'active',
    gm."joined_at"
FROM "GroupMember" gm
ON CONFLICT DO NOTHING;

-- AlterTable: Update Vote table to use participant_id
-- Step 1: Add participant_id column (nullable initially)
ALTER TABLE "Vote" ADD COLUMN "participant_id" TEXT;

-- Step 2: Migrate existing votes to use participant_id
UPDATE "Vote" v
SET "participant_id" = (
    SELECT gp."id"
    FROM "GroupParticipant" gp
    JOIN "VotingRound" vr ON vr."id" = v."round_id"
    JOIN "DecisionSession" ds ON ds."id" = vr."session_id"
    WHERE gp."user_id" = v."user_id"
    AND gp."group_id" = ds."group_id"
    AND gp."type" = 'member'
    LIMIT 1
)
WHERE v."participant_id" IS NULL;

-- Step 3: Make participant_id NOT NULL
ALTER TABLE "Vote" ALTER COLUMN "participant_id" SET NOT NULL;

-- Step 4: Drop old user_id column and unique constraint
ALTER TABLE "Vote" DROP CONSTRAINT IF EXISTS "Vote_round_id_user_id_movie_tmdb_id_key";
ALTER TABLE "Vote" DROP COLUMN "user_id";

-- Step 5: Create new unique constraint
CREATE UNIQUE INDEX "Vote_round_id_participant_id_movie_tmdb_id_key" ON "Vote"("round_id", "participant_id", "movie_tmdb_id");

-- Step 6: Create new indexes
CREATE INDEX IF NOT EXISTS "Vote_participant_id_idx" ON "Vote"("participant_id");

-- Step 7: Add foreign key
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "GroupParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
