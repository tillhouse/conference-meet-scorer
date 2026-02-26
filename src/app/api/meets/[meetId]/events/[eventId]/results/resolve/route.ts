import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTimeToSeconds } from "@/lib/utils";
import { buildSchoolToTeamIdMap, resolveSchoolToTeamId } from "@/lib/real-results-matching";
import type { UnresolvedRow } from "../route";

async function recomputeMeetTeamScores(meetId: string) {
  const meet = await prisma.meet.findUnique({
    where: { id: meetId },
    select: { scoringPlaces: true, individualScoring: true, relayScoring: true, divingScoring: true },
  });
  if (!meet) return;
  const individualScoring = meet.individualScoring
    ? (JSON.parse(meet.individualScoring) as Record<string, number>)
    : {};
  const relayScoring = meet.relayScoring
    ? (JSON.parse(meet.relayScoring) as Record<string, number>)
    : {};
  const divingScoring = meet.divingScoring
    ? (JSON.parse(meet.divingScoring) as Record<string, number>)
    : individualScoring;

  const meetTeams = await prisma.meetTeam.findMany({
    where: { meetId },
    include: { team: true },
  });

  for (const meetTeam of meetTeams) {
    const selectedAthletes = meetTeam.selectedAthletes
      ? (JSON.parse(meetTeam.selectedAthletes) as string[])
      : [];
    const mt = meetTeam as typeof meetTeam & { testSpotAthleteIds?: string | null; testSpotScoringAthleteId?: string | null };
    const testSpotAthleteIds = mt.testSpotAthleteIds ? (JSON.parse(mt.testSpotAthleteIds) as string[]) : [];
    let testSpotScoringAthleteId = mt.testSpotScoringAthleteId;
    if (testSpotAthleteIds.length > 0 && (!testSpotScoringAthleteId || !testSpotAthleteIds.includes(testSpotScoringAthleteId))) {
      testSpotScoringAthleteId = testSpotAthleteIds[0];
    }
    const { getScoringAthleteIdSet } = await import("@/lib/meet-scoring");
    const scoringSet = getScoringAthleteIdSet(selectedAthletes, testSpotAthleteIds, testSpotScoringAthleteId ?? null);

    const teamLineups = await prisma.meetLineup.findMany({
      where: { meetId, athlete: { teamId: meetTeam.teamId } },
      include: { event: true },
    });
    const teamRelays = await prisma.relayEntry.findMany({
      where: { meetId, teamId: meetTeam.teamId },
    });
    const individualEntries = teamLineups.filter(
      (l) => l.event.eventType === "individual" && scoringSet.has(l.athleteId)
    );
    const divingEntries = teamLineups.filter(
      (l) => l.event.eventType === "diving" && scoringSet.has(l.athleteId)
    );
    const individualScore = individualEntries.reduce((s, e) => s + (e.points ?? 0), 0);
    const divingScore = divingEntries.reduce((s, e) => s + (e.points ?? 0), 0);
    const relayScore = teamRelays.reduce((s, r) => s + (r.points ?? 0), 0);
    await prisma.meetTeam.update({
      where: { id: meetTeam.id },
      data: {
        individualScore,
        divingScore,
        relayScore,
        totalScore: individualScore + divingScore + relayScore,
      },
    });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string; eventId: string }> }
) {
  try {
    const { meetId, eventId } = await params;
    const body = await request.json().catch(() => ({}));
    const row = body.unresolvedRow as UnresolvedRow | undefined;
    const athleteId = body.athleteId as string | undefined;
    const addAsNew = body.addAsNew as { firstName: string; lastName: string } | undefined;

    if (!row || (!athleteId && !addAsNew)) {
      return NextResponse.json(
        { error: "unresolvedRow and either athleteId or addAsNew required" },
        { status: 400 }
      );
    }

    const meet = await prisma.meet.findUnique({
      where: { id: meetId },
      include: { meetTeams: { include: { team: true } } },
    });
    if (!meet) {
      return NextResponse.json({ error: "Meet not found" }, { status: 404 });
    }
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event || (event.eventType !== "individual" && event.eventType !== "diving")) {
      return NextResponse.json({ error: "Event not found or not individual/diving" }, { status: 404 });
    }

    const schoolToTeamId = buildSchoolToTeamIdMap(
      meet.meetTeams.map((mt) => ({ teamId: mt.teamId, team: mt.team }))
    );
    const schoolLabel = row.schoolCode || row.school || "";
    const teamId = resolveSchoolToTeamId(schoolLabel, schoolToTeamId);
    if (!teamId) {
      return NextResponse.json({ error: "Could not resolve team for row" }, { status: 400 });
    }

    let targetAthleteId: string;

    if (athleteId) {
      const athlete = await prisma.athlete.findFirst({
        where: { id: athleteId, teamId },
      });
      if (!athlete) {
        return NextResponse.json({ error: "Athlete not found or wrong team" }, { status: 400 });
      }
      targetAthleteId = athleteId;
    } else if (addAsNew?.firstName != null && addAsNew?.lastName != null) {
      const newAthlete = await prisma.athlete.create({
        data: {
          teamId,
          firstName: addAsNew.firstName.trim() || "Unknown",
          lastName: addAsNew.lastName.trim() || "Unknown",
          isDiver: event.eventType === "diving",
        },
      });
      targetAthleteId = newAthlete.id;
      const meetTeamRow = await prisma.meetTeam.findFirst({
        where: { meetId, teamId },
      });
      if (meetTeamRow) {
        const selected = meetTeamRow.selectedAthletes
          ? (JSON.parse(meetTeamRow.selectedAthletes) as string[])
          : [];
        if (!selected.includes(newAthlete.id)) {
          selected.push(newAthlete.id);
          await prisma.meetTeam.update({
            where: { id: meetTeamRow.id },
            data: { selectedAthletes: JSON.stringify(selected) },
          });
        }
      }
    } else {
      return NextResponse.json({ error: "Provide athleteId or addAsNew" }, { status: 400 });
    }

    const timeStr = event.eventType === "diving" ? (row.score ?? "") : (row.timeStr ?? "");
    const timeSeconds = parseTimeToSeconds(timeStr);
    let scoring: Record<string, number> = {};
    try {
      if (event.eventType === "diving" && meet.divingScoring) {
        scoring = JSON.parse(meet.divingScoring) as Record<string, number>;
      } else if (meet.individualScoring) {
        scoring = JSON.parse(meet.individualScoring) as Record<string, number>;
      }
    } catch {
      scoring = {};
    }
    const points = row.place <= (meet.scoringPlaces ?? 24) ? (scoring[row.place.toString()] ?? 0) : 0;

    let lineup = await prisma.meetLineup.findUnique({
      where: {
        meetId_athleteId_eventId: { meetId, athleteId: targetAthleteId, eventId },
      },
    });
    if (!lineup) {
      lineup = await prisma.meetLineup.create({
        data: {
          meetId,
          athleteId: targetAthleteId,
          eventId,
          finalTime: timeStr,
          finalTimeSeconds: timeSeconds,
          place: row.place,
          points,
          realResultApplied: true,
        },
      });
    } else {
      await prisma.meetLineup.update({
        where: { id: lineup.id },
        data: {
          finalTime: timeStr,
          finalTimeSeconds: timeSeconds,
          place: row.place,
          points,
          realResultApplied: true,
        },
      });
    }

    await recomputeMeetTeamScores(meetId);

    return NextResponse.json({
      success: true,
      lineupId: lineup.id,
      athleteId: targetAthleteId,
    });
  } catch (err) {
    console.error("Resolve result error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to resolve" },
      { status: 500 }
    );
  }
}
