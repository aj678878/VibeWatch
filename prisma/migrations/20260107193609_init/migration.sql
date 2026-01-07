-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "invite_code" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupWatchlist" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "tmdb_id" INTEGER NOT NULL,

    CONSTRAINT "GroupWatchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionSession" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "vibe_text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "current_round" INTEGER NOT NULL DEFAULT 1,
    "final_movie_tmdb_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VotingRound" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "round_number" INTEGER NOT NULL,
    "movie_tmdb_ids" JSONB NOT NULL,

    CONSTRAINT "VotingRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "movie_tmdb_id" INTEGER NOT NULL,
    "vote" TEXT NOT NULL,
    "reason_text" TEXT,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Group_invite_code_key" ON "Group"("invite_code");

-- CreateIndex
CREATE INDEX "Group_invite_code_idx" ON "Group"("invite_code");

-- CreateIndex
CREATE INDEX "Group_created_by_user_id_idx" ON "Group"("created_by_user_id");

-- CreateIndex
CREATE INDEX "GroupMember_user_id_idx" ON "GroupMember"("user_id");

-- CreateIndex
CREATE INDEX "GroupMember_group_id_idx" ON "GroupMember"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_user_id_group_id_key" ON "GroupMember"("user_id", "group_id");

-- CreateIndex
CREATE INDEX "GroupWatchlist_group_id_idx" ON "GroupWatchlist"("group_id");

-- CreateIndex
CREATE INDEX "GroupWatchlist_tmdb_id_idx" ON "GroupWatchlist"("tmdb_id");

-- CreateIndex
CREATE UNIQUE INDEX "GroupWatchlist_group_id_tmdb_id_key" ON "GroupWatchlist"("group_id", "tmdb_id");

-- CreateIndex
CREATE INDEX "DecisionSession_group_id_idx" ON "DecisionSession"("group_id");

-- CreateIndex
CREATE INDEX "DecisionSession_status_idx" ON "DecisionSession"("status");

-- CreateIndex
CREATE INDEX "VotingRound_session_id_idx" ON "VotingRound"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "VotingRound_session_id_round_number_key" ON "VotingRound"("session_id", "round_number");

-- CreateIndex
CREATE INDEX "Vote_round_id_idx" ON "Vote"("round_id");

-- CreateIndex
CREATE INDEX "Vote_user_id_idx" ON "Vote"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_round_id_user_id_movie_tmdb_id_key" ON "Vote"("round_id", "user_id", "movie_tmdb_id");

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupWatchlist" ADD CONSTRAINT "GroupWatchlist_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionSession" ADD CONSTRAINT "DecisionSession_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingRound" ADD CONSTRAINT "VotingRound_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "DecisionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "VotingRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
