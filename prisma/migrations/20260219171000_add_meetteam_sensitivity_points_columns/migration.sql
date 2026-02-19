-- AlterTable
-- Add all remaining sensitivity columns expected by deployed app (MeetTeam) to avoid repeated P2022 errors
ALTER TABLE "MeetTeam" ADD COLUMN IF NOT EXISTS "sensitivityAthletePointsBaseline" REAL;
ALTER TABLE "MeetTeam" ADD COLUMN IF NOT EXISTS "sensitivityAthletePointsBetter" REAL;
ALTER TABLE "MeetTeam" ADD COLUMN IF NOT EXISTS "sensitivityAthletePointsWorse" REAL;
