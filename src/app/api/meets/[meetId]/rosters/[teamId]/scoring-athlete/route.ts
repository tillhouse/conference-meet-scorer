import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getScoringAthleteIdSet } from "@/lib/meet-scoring";
import { z } from "zod";

const bodySchema = z.object({
  scoringAthleteId: z.string(),
});

/**
 * Recompute one team's scores from lineups and relays using the scoring roster rule.
 */
async function recomputeTeamScores(
  meetId: string,
  meetTeamId: string,
  teamId: string,
  scoringSet: Set<string>
) {
  const teamLineups = await prisma.meetLineup.findMany({
    where: {
      meetId,
      athlete: { teamId },
    },
    include: { event: true },
  });
  const teamRelays = await prisma.relayEntry.findMany({
    where: { meetId, teamId },
  });

  const individualEntries = teamLineups.filter(
    (l) => l.event.eventType === "individual" && scoringSet.has(l.athleteId)
  );
  const divingEntries = teamLineups.filter(
    (l) => l.event.eventType === "diving" && scoringSet.has(l.athleteId)
  );

  const individualScore = individualEntries.reduce((sum, e) => sum + (e.points || 0), 0);
  const divingScore = divingEntries.reduce((sum, e) => sum + (e.points || 0), 0);
  const relayScore = teamRelays.reduce((sum, r) => sum + (r.points || 0), 0);
  const totalScore = individualScore + divingScore + relayScore;

  await prisma.meetTeam.update({
    where: { id: meetTeamId },
    data: {
      individualScore,
      divingScore,
      relayScore,
      totalScore,
    },
  });

  return { individualScore, divingScore, relayScore, totalScore };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string; teamId: string }> }
) {
  try {
    const { meetId, teamId } = await params;
    const body = await request.json();
    const data = bodySchema.parse(body);

    const meetTeam = await prisma.meetTeam.findUnique({
      where: {
        meetId_teamId: { meetId, teamId },
      },
    });

    if (!meetTeam) {
      return NextResponse.json({ error: "Meet team not found" }, { status: 404 });
    }

    const selectedAthletes = meetTeam.selectedAthletes
      ? (JSON.parse(meetTeam.selectedAthletes) as string[])
      : [];
    const testSpotAthleteIds = meetTeam.testSpotAthleteIds
      ? (JSON.parse(meetTeam.testSpotAthleteIds) as string[])
      : [];
    const currentScoringId = meetTeam.testSpotScoringAthleteId;

    if (testSpotAthleteIds.length === 0) {
      return NextResponse.json(
        { error: "This team has no test spot; cannot set scoring athlete" },
        { status: 400 }
      );
    }

    const testSpotSet = new Set(testSpotAthleteIds);
    if (!testSpotSet.has(data.scoringAthleteId)) {
      return NextResponse.json(
        { error: "scoringAthleteId must be one of the test spot athletes" },
        { status: 400 }
      );
    }

    if (currentScoringId === data.scoringAthleteId) {
      return NextResponse.json({
        success: true,
        message: "Scoring athlete unchanged",
        individualScore: meetTeam.individualScore,
        divingScore: meetTeam.divingScore,
        relayScore: meetTeam.relayScore,
        totalScore: meetTeam.totalScore,
      });
    }

    await prisma.meetTeam.update({
      where: { id: meetTeam.id },
      data: { testSpotScoringAthleteId: data.scoringAthleteId },
    });

    const scoringSet = getScoringAthleteIdSet(
      selectedAthletes,
      testSpotAthleteIds,
      data.scoringAthleteId
    );
    const scores = await recomputeTeamScores(meetId, meetTeam.id, teamId, scoringSet);

    return NextResponse.json({
      success: true,
      message: "Scoring athlete updated",
      ...scores,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating scoring athlete:", error);
    return NextResponse.json(
      { error: "Failed to update scoring athlete" },
      { status: 500 }
    );
  }
}
