-- AlterTable
-- Add test spot and sensitivity analysis columns to MeetTeam (missing in production)
ALTER TABLE "MeetTeam" ADD COLUMN IF NOT EXISTS "testSpotAthleteIds" TEXT;
ALTER TABLE "MeetTeam" ADD COLUMN IF NOT EXISTS "testSpotScoringAthleteId" TEXT;
-- Support both old (singular) and current (plural) schema for compatibility
ALTER TABLE "MeetTeam" ADD COLUMN IF NOT EXISTS "sensitivityAthleteId" TEXT;
ALTER TABLE "MeetTeam" ADD COLUMN IF NOT EXISTS "sensitivityAthleteIds" TEXT;
ALTER TABLE "MeetTeam" ADD COLUMN IF NOT EXISTS "sensitivityPercent" REAL;
ALTER TABLE "MeetTeam" ADD COLUMN IF NOT EXISTS "sensitivityVariant" TEXT;
ALTER TABLE "MeetTeam" ADD COLUMN IF NOT EXISTS "sensitivityVariantAthleteId" TEXT;
ALTER TABLE "MeetTeam" ADD COLUMN IF NOT EXISTS "sensitivityResults" TEXT;
