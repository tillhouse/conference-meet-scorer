import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTimeToSeconds } from "@/lib/utils";
import { getScoringAthleteIdSet } from "@/lib/meet-scoring";
import {
  parseResultText,
  type IndividualRow,
  type RelayRow,
  type DivingRow,
  type ParseResult,
} from "@/lib/real-results-parser";
import {
  buildSchoolToTeamIdMap,
  resolveSchoolToTeamId,
  matchAthleteByName,
  normalizeParsedName,
  type AthleteForMatch,
} from "@/lib/real-results-matching";

export type UnresolvedRow = {
  place: number;
  name?: string;
  school?: string;
  schoolCode?: string;
  timeStr?: string;
  score?: string;
  reason: "no_team" | "no_athlete_match" | "multiple_candidates";
  candidateAthleteIds?: string[];
};

async function recomputeMeetTeamScores(meetId: string) {
  const meet = await prisma.meet.findUnique({
    where: { id: meetId },
    select: {
      scoringPlaces: true,
      individualScoring: true,
      relayScoring: true,
    },
  });
  if (!meet) return;

  const individualScoring = meet.individualScoring
    ? (JSON.parse(meet.individualScoring) as Record<string, number>)
    : {};
  const relayScoring = meet.relayScoring
    ? (JSON.parse(meet.relayScoring) as Record<string, number>)
    : {};

  const meetTeams = await prisma.meetTeam.findMany({
    where: { meetId },
    include: { team: true },
  });

  for (const meetTeam of meetTeams) {
    const selectedAthletes = meetTeam.selectedAthletes
      ? (JSON.parse(meetTeam.selectedAthletes) as string[])
      : [];
    const mt = meetTeam as typeof meetTeam & {
      testSpotAthleteIds?: string | null;
      testSpotScoringAthleteId?: string | null;
    };
    const testSpotAthleteIds = mt.testSpotAthleteIds
      ? (JSON.parse(mt.testSpotAthleteIds) as string[])
      : [];
    let testSpotScoringAthleteId = mt.testSpotScoringAthleteId;
    if (
      testSpotAthleteIds.length > 0 &&
      (!testSpotScoringAthleteId || !testSpotAthleteIds.includes(testSpotScoringAthleteId))
    ) {
      testSpotScoringAthleteId = testSpotAthleteIds[0];
    }
    const scoringSet = getScoringAthleteIdSet(
      selectedAthletes,
      testSpotAthleteIds,
      testSpotScoringAthleteId ?? null
    );

    const teamLineups = await prisma.meetLineup.findMany({
      where: {
        meetId,
        athlete: { teamId: meetTeam.teamId },
      },
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
    const individualScore = individualEntries.reduce((sum, e) => sum + (e.points ?? 0), 0);
    const divingScore = divingEntries.reduce((sum, e) => sum + (e.points ?? 0), 0);
    const relayScore = teamRelays.reduce((sum, r) => sum + (r.points ?? 0), 0);
    const totalScore = individualScore + divingScore + relayScore;

    await prisma.meetTeam.update({
      where: { id: meetTeam.id },
      data: {
        individualScore,
        divingScore,
        relayScore,
        totalScore,
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
    const resultText =
      typeof body.resultText === "string" ? body.resultText : "";
    const eventTypeHint = body.eventType; // "individual" | "relay" | "diving"
    const addUnknownAthletes = body.addUnknownAthletes !== false;

    if (!resultText.trim()) {
      return NextResponse.json(
        { error: "resultText is required" },
        { status: 400 }
      );
    }

    const meet = await prisma.meet.findUnique({
      where: { id: meetId },
      include: {
        meetTeams: { include: { team: true } },
      },
    });
    if (!meet) {
      return NextResponse.json({ error: "Meet not found" }, { status: 404 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const individualScoring = meet.individualScoring
      ? (JSON.parse(meet.individualScoring) as Record<string, number>)
      : {};
    const relayScoring = meet.relayScoring
      ? (JSON.parse(meet.relayScoring) as Record<string, number>)
      : {};
    const divingScoring = meet.divingScoring
      ? (JSON.parse(meet.divingScoring) as Record<string, number>)
      : individualScoring;

    const schoolToTeamId = buildSchoolToTeamIdMap(
      meet.meetTeams.map((mt) => ({
        teamId: mt.teamId,
        team: mt.team,
      }))
    );

    const parsed = parseResultText(resultText, eventTypeHint);
    const errors: string[] = [...(parsed.errors || [])];
    const unresolved: UnresolvedRow[] = [];
    let appliedLineups = 0;
    let appliedRelays = 0;
    const addedAthleteIds: string[] = [];

    const scoringTable =
      event.eventType === "relay" ? relayScoring : event.eventType === "diving" ? divingScoring : individualScoring;

    function pointsForPlace(place: number): number {
      return place <= (meet.scoringPlaces ?? 24)
        ? (scoringTable[place.toString()] ?? 0)
        : 0;
    }

    if (event.eventType === "relay") {
      const res = parsed as ParseResult<RelayRow>;
      for (const row of res.rows) {
        const teamId = resolveSchoolToTeamId(row.school, schoolToTeamId);
        if (!teamId) {
          unresolved.push({
            place: row.place,
            school: row.school,
            timeStr: row.timeStr,
            reason: "no_team",
          });
          continue;
        }
        const points =
          row.points != null ? row.points : pointsForPlace(row.place);
        const timeSeconds = parseTimeToSeconds(row.timeStr);

        let relay = await prisma.relayEntry.findUnique({
          where: {
            meetId_eventId_teamId: { meetId, eventId, teamId },
          },
        });
        if (!relay) {
          relay = await prisma.relayEntry.create({
            data: {
              meetId,
              eventId,
              teamId,
              finalTime: row.timeStr,
              finalTimeSeconds: timeSeconds,
              place: row.place,
              points,
            },
          });
        } else {
          await prisma.relayEntry.update({
            where: { id: relay.id },
            data: {
              finalTime: row.timeStr,
              finalTimeSeconds: timeSeconds,
              place: row.place,
              points,
            },
          });
        }
        appliedRelays++;
      }
    } else {
      const res = parsed as ParseResult<IndividualRow> | ParseResult<DivingRow>;
      const rows = res.rows as (IndividualRow | DivingRow)[];
      const isDiving = event.eventType === "diving";

      for (const row of rows) {
        const schoolLabel = isDiving
          ? (row as DivingRow).schoolCode
          : (row as IndividualRow).school;
        const teamId = resolveSchoolToTeamId(
          schoolLabel || "",
          schoolToTeamId
        );
        if (!teamId) {
          unresolved.push({
            place: row.place,
            name: row.name,
            school: (row as IndividualRow).school,
            schoolCode: (row as DivingRow).schoolCode,
            timeStr: (row as IndividualRow).timeStr,
            score: (row as DivingRow).score,
            reason: "no_team",
          });
          continue;
        }

        const teamAthletes = await prisma.athlete.findMany({
          where: { teamId },
          select: { id: true, firstName: true, lastName: true },
        });
        const athletesForMatch: AthleteForMatch[] = teamAthletes.map((a) => ({
          id: a.id,
          firstName: a.firstName,
          lastName: a.lastName,
        }));

        const nameStr = row.name || "";
        const matchResult = matchAthleteByName(nameStr, athletesForMatch);

        let athleteId: string | null = null;

        if (matchResult.kind === "match") {
          athleteId = matchResult.athlete.id;
        } else if (matchResult.kind === "candidates") {
          unresolved.push({
            place: row.place,
            name: nameStr,
            school: (row as IndividualRow).school,
            schoolCode: (row as DivingRow).schoolCode,
            timeStr: (row as IndividualRow).timeStr,
            score: (row as DivingRow).score,
            reason: "multiple_candidates",
            candidateAthleteIds: matchResult.athletes.map((a) => a.id),
          });
          continue;
        } else if (addUnknownAthletes) {
          const { firstName, lastName } = normalizeParsedName(nameStr);
          const newAthlete = await prisma.athlete.create({
            data: {
              teamId,
              firstName: firstName || "Unknown",
              lastName: lastName || "Unknown",
              isDiver: isDiving,
            },
          });
          athleteId = newAthlete.id;
          addedAthleteIds.push(newAthlete.id);

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
          unresolved.push({
            place: row.place,
            name: nameStr,
            school: (row as IndividualRow).school,
            schoolCode: (row as DivingRow).schoolCode,
            timeStr: (row as IndividualRow).timeStr,
            score: (row as DivingRow).score,
            reason: "no_athlete_match",
          });
          continue;
        }

        const timeStr = isDiving
          ? (row as DivingRow).score
          : (row as IndividualRow).timeStr;
        const timeSeconds = parseTimeToSeconds(timeStr);
        const points = pointsForPlace(row.place);

        let lineup = await prisma.meetLineup.findUnique({
          where: {
            meetId_athleteId_eventId: { meetId, athleteId: athleteId!, eventId },
          },
        });
        if (!lineup) {
          lineup = await prisma.meetLineup.create({
            data: {
              meetId,
              athleteId: athleteId!,
              eventId,
              finalTime: timeStr,
              finalTimeSeconds: timeSeconds,
              place: row.place,
              points,
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
            },
          });
        }
        appliedLineups++;
      }
    }

    await recomputeMeetTeamScores(meetId);

    let realResultsEventIds: string[] = [];
    try {
      realResultsEventIds = meet.realResultsEventIds
        ? (JSON.parse(meet.realResultsEventIds) as string[])
        : [];
    } catch {
      realResultsEventIds = [];
    }
    if (!realResultsEventIds.includes(eventId)) {
      realResultsEventIds.push(eventId);
    }
    await prisma.meet.update({
      where: { id: meetId },
      data: {
        realResultsEventIds: JSON.stringify(realResultsEventIds),
        scoringMode: meet.scoringMode === "simulated" ? "hybrid" : meet.scoringMode,
      },
    });

    return NextResponse.json({
      success: true,
      appliedLineups,
      appliedRelays,
      addedAthletes: addedAthleteIds.length,
      unresolved,
      parseErrors: errors,
    });
  } catch (err) {
    console.error("Apply results error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to apply results" },
      { status: 500 }
    );
  }
}
