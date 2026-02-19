-- AlterTable
-- Add sensitivity total score columns expected by deployed app (MeetTeam)
ALTER TABLE "MeetTeam" ADD COLUMN IF NOT EXISTS "sensitivityTotalScoreBetter" REAL;
ALTER TABLE "MeetTeam" ADD COLUMN IF NOT EXISTS "sensitivityTotalScoreWorse" REAL;
