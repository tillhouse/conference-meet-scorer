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
      const relayRows = res.rows;
      const scoringPlacesLimitRelay = meet.scoringPlaces ?? 24;
      const normalizedRelays: { row: RelayRow; place: number | null; points: number }[] = [];
      let nextPlaceRelay = 1;
      let ri = 0;
      while (ri < relayRows.length) {
        const current = relayRows[ri]!;
        if (current.place == null || current.disqualified) {
          normalizedRelays.push({ row: current, place: null, points: 0 });
          ri++;
          continue;
        }
        const group: RelayRow[] = [current];
        ri++;
        while (ri < relayRows.length && relayRows[ri]!.place !== null && relayRows[ri]!.place === group[0]!.place) {
          group.push(relayRows[ri]!);
          ri++;
        }
        const placeStart = nextPlaceRelay;
        const placeEnd = nextPlaceRelay + group.length - 1;
        const pointSum = Array.from({ length: group.length }, (_, k) =>
          placeStart + k <= scoringPlacesLimitRelay ? (relayScoring[(placeStart + k).toString()] ?? 0) : 0
        ).reduce((a, b) => a + b, 0);
        const avgPoints = group.length > 0 ? pointSum / group.length : 0;
        group.forEach((row) => {
          normalizedRelays.push({ row, place: placeStart, points: avgPoints });
        });
        nextPlaceRelay = placeEnd + 1;
      }

      for (const { row, place: assignedPlace, points: assignedPoints } of normalizedRelays) {
        const teamId = resolveSchoolToTeamId(row.school, schoolToTeamId);
        if (!teamId) {
          unresolved.push({
            place: row.place ?? 0,
            school: row.school,
            timeStr: row.timeStr,
            reason: "no_team",
          });
          continue;
        }
        const timeSeconds = row.timeStr === "DQ" || row.timeStr === "XDQ" ? null : parseTimeToSeconds(row.timeStr);

        // Build splitsData from parsed leg data (for Actual view display). Do NOT write members
        // or legTimes - those belong to the projected lineup from Create Relays.
        let splitsDataJson: string | undefined;
        if (row.legs && row.legs.length > 0) {
          const splitsData = {
            legs: row.legs.map((leg) => ({
              reactionTimeSeconds: leg.reactionTimeSeconds,
              name: leg.name,
              cumulativeLeg: leg.cumulativeLeg,
              subSplits: leg.subSplits,
            })),
            relayCumulativeAt50: row.relayCumulativeAt50 ?? [],
          };
          splitsDataJson = JSON.stringify(splitsData);
        }

        let relay = await prisma.relayEntry.findUnique({
          where: {
            meetId_teamId_eventId: { meetId, teamId, eventId },
          },
        });
        // Only update actual-result fields (finalTime, place, points, splitsData). Do NOT overwrite
        // members or legTimes - those are for the projected lineup from Create Relays.
        if (!relay) {
          relay = await prisma.relayEntry.create({
            data: {
              meetId,
              eventId,
              teamId,
              finalTime: row.timeStr,
              finalTimeSeconds: timeSeconds,
              place: assignedPlace,
              points: assignedPoints,
              realResultApplied: true,
              ...(splitsDataJson != null && { splitsData: splitsDataJson }),
            },
          });
        } else {
          await prisma.relayEntry.update({
            where: { id: relay.id },
            data: {
              finalTime: row.timeStr,
              finalTimeSeconds: timeSeconds,
              place: assignedPlace,
              points: assignedPoints,
              realResultApplied: true,
              ...(splitsDataJson != null && { splitsData: splitsDataJson }),
            },
          });
        }
        appliedRelays++;
      }
    } else {
      const res = parsed as ParseResult<IndividualRow> | ParseResult<DivingRow>;
      const rows = res.rows as (IndividualRow | DivingRow)[];
      const isDiving = event.eventType === "diving";

      // Normalize places and points for ties: consecutive same place => same stored place, split points; next place skips
      const scoringPlacesLimit = meet.scoringPlaces ?? 24;
      const normalizedRows: { row: (IndividualRow | DivingRow); place: number; points: number }[] = [];
      let nextPlace = 1;
      let idx = 0;
      while (idx < rows.length) {
        const group: (IndividualRow | DivingRow)[] = [rows[idx]!];
        idx++;
        while (idx < rows.length && rows[idx]!.place === group[0]!.place) {
          group.push(rows[idx]!);
          idx++;
        }
        const placeStart = nextPlace;
        const placeEnd = nextPlace + group.length - 1;
        const pointSum = Array.from({ length: group.length }, (_, k) =>
          placeStart + k <= scoringPlacesLimit ? (scoringTable[(placeStart + k).toString()] ?? 0) : 0
        ).reduce((a, b) => a + b, 0);
        const avgPoints = group.length > 0 ? pointSum / group.length : 0;
        group.forEach((row) => {
          normalizedRows.push({ row, place: placeStart, points: avgPoints });
        });
        nextPlace = placeEnd + 1;
      }

      for (const { row, place: assignedPlace, points: assignedPoints } of normalizedRows) {
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
          select: { id: true, firstName: true, lastName: true, year: true },
        });
        const athletesForMatch: AthleteForMatch[] = teamAthletes.map((a) => ({
          id: a.id,
          firstName: a.firstName,
          lastName: a.lastName,
          year: a.year ?? null,
        }));

        const nameStr = row.name || "";
        const parsedYear = (row as IndividualRow).year ?? (row as DivingRow).year ?? null;
        const matchResult = matchAthleteByName(nameStr, athletesForMatch, parsedYear);

        let athleteId: string | null = null;

        if (matchResult.kind === "match") {
          athleteId = matchResult.athlete.id;
          if (parsedYear && !matchResult.athlete.year?.trim()) {
            await prisma.athlete.update({
              where: { id: matchResult.athlete.id },
              data: { year: parsedYear },
            });
          }
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
              year: parsedYear ?? undefined,
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
              place: assignedPlace,
              points: assignedPoints,
              realResultApplied: true,
            },
          });
        } else {
          await prisma.meetLineup.update({
            where: { id: lineup.id },
            data: {
              finalTime: timeStr,
              finalTimeSeconds: timeSeconds,
              place: assignedPlace,
              points: assignedPoints,
              realResultApplied: true,
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

/** Clear all results (place, time, points, splits) for this event. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ meetId: string; eventId: string }> }
) {
  try {
    const { meetId, eventId } = await params;
    if (!meetId || !eventId) {
      return NextResponse.json(
        { error: "meetId and eventId are required" },
        { status: 400 }
      );
    }

    await prisma.meetLineup.updateMany({
      where: { meetId, eventId },
      data: {
        finalTime: null,
        finalTimeSeconds: null,
        place: null,
        points: null,
        realResultApplied: false,
        splitsData: null, // Parsed actual splits from Apply results
      },
    });

    await prisma.relayEntry.updateMany({
      where: { meetId, eventId },
      data: {
        finalTime: null,
        finalTimeSeconds: null,
        place: null,
        points: null,
        realResultApplied: false,
        splitsData: null, // Parsed actual splits; members/legTimes (projected) are preserved
      },
    });

    await recomputeMeetTeamScores(meetId);

    // Ensure event is in realResultsEventIds so the table shows only finalTime entries (empty after clear).
    // If the event was never applied (only simulated), it wouldn't be in the list otherwise.
    const meet = await prisma.meet.findUnique({
      where: { id: meetId },
      select: { realResultsEventIds: true, scoringMode: true },
    });
    if (meet) {
      let ids: string[] = [];
      try {
        ids = meet.realResultsEventIds ? (JSON.parse(meet.realResultsEventIds) as string[]) : [];
      } catch {
        ids = [];
      }
      if (!ids.includes(eventId)) {
        ids.push(eventId);
        await prisma.meet.update({
          where: { id: meetId },
          data: {
            realResultsEventIds: JSON.stringify(ids),
            ...(meet.scoringMode === "simulated" ? { scoringMode: "hybrid" } : {}),
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Clear results error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to clear results" },
      { status: 500 }
    );
  }
}
