import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTimeToSeconds, formatSecondsToTime } from "@/lib/utils";
import { getScoringAthleteIdSet } from "@/lib/meet-scoring";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string }> }
) {
  try {
    const { meetId } = await params;

    // Fetch the meet with all related data (force fresh read from database)
    const meet = await prisma.meet.findUnique({
      where: { id: meetId },
      include: {
        meetLineups: {
          include: {
            athlete: {
              include: {
                team: true,
              },
            },
            event: true,
          },
        },
        relayEntries: {
          include: {
            team: true,
            event: true,
          },
        },
      },
    });

    if (!meet) {
      return NextResponse.json({ error: "Meet not found" }, { status: 404 });
    }

    // Parse scoring tables
    const individualScoring = meet.individualScoring
      ? (JSON.parse(meet.individualScoring) as Record<string, number>)
      : {};
    const relayScoring = meet.relayScoring
      ? (JSON.parse(meet.relayScoring) as Record<string, number>)
      : {};

    // Group lineups by event
    const lineupsByEvent: Record<string, typeof meet.meetLineups> = {};
    meet.meetLineups.forEach((lineup) => {
      if (!lineupsByEvent[lineup.eventId]) {
        lineupsByEvent[lineup.eventId] = [];
      }
      lineupsByEvent[lineup.eventId].push(lineup);
    });

    // Group relays by event
    const relaysByEvent: Record<string, typeof meet.relayEntries> = {};
    meet.relayEntries.forEach((relay) => {
      if (!relaysByEvent[relay.eventId]) {
        relaysByEvent[relay.eventId] = [];
      }
      relaysByEvent[relay.eventId].push(relay);
    });

    // Process individual events and diving
    for (const [eventId, lineups] of Object.entries(lineupsByEvent)) {
      if (lineups.length === 0) continue;

      const eventType = lineups[0].event.eventType;

      // Sort by time (use override if present, otherwise seed)
      const sorted = [...lineups].sort((a, b) => {
        // Use override time if present, otherwise use seed time
        let aTime = a.overrideTimeSeconds ?? a.seedTimeSeconds;
        let bTime = b.overrideTimeSeconds ?? b.seedTimeSeconds;

        // If timeSeconds is null, try to parse from time string
        if (aTime === null) {
          const timeStr = a.overrideTime ?? a.seedTime;
          if (timeStr) {
            aTime = parseTimeToSeconds(timeStr);
          }
        }
        if (bTime === null) {
          const timeStr = b.overrideTime ?? b.seedTime;
          if (timeStr) {
            bTime = parseTimeToSeconds(timeStr);
          }
        }

        // Default to 0 if still null
        aTime = aTime ?? 0;
        bTime = bTime ?? 0;

        if (eventType === "diving") {
          // Diving: higher score is better
          return bTime - aTime;
        } else {
          // Swimming: lower time is better
          return aTime - bTime;
        }
      });

      // Assign places and calculate points (handling ties)
      let currentPlace = 1;
      for (let i = 0; i < sorted.length; i++) {
        // Find all entries with the same time (ties)
        const currentTime = (() => {
          const overrideTime = sorted[i].overrideTimeSeconds ?? sorted[i].seedTimeSeconds;
          if (overrideTime !== null) return overrideTime;
          const timeStr = sorted[i].overrideTime ?? sorted[i].seedTime;
          return timeStr ? parseTimeToSeconds(timeStr) : 0;
        })();

        const tiedEntries: typeof sorted = [sorted[i]];
        let j = i + 1;
        while (j < sorted.length) {
          const nextTime = (() => {
            const overrideTime = sorted[j].overrideTimeSeconds ?? sorted[j].seedTimeSeconds;
            if (overrideTime !== null) return overrideTime;
            const timeStr = sorted[j].overrideTime ?? sorted[j].seedTime;
            return timeStr ? parseTimeToSeconds(timeStr) : 0;
          })();

          // Check if times are equal (accounting for floating point precision)
          // Use a very small tolerance (0.001s = 1ms) to handle floating point rounding
          // but not so large that it incorrectly ties times that differ by 0.01s (hundredths)
          const isEqual = eventType === "diving"
            ? Math.abs(currentTime - nextTime) < 0.001
            : Math.abs(currentTime - nextTime) < 0.001;

          if (isEqual) {
            tiedEntries.push(sorted[j]);
            j++;
          } else {
            break;
          }
        }

        // Calculate average points for tied entries
        const tieCount = tiedEntries.length;
        const placesOccupied = Array.from({ length: tieCount }, (_, idx) => currentPlace + idx);
        const totalPoints = placesOccupied.reduce((sum, place) => {
          return sum + (place <= meet.scoringPlaces ? (individualScoring[place.toString()] || 0) : 0);
        }, 0);
        const averagePoints = tieCount > 0 ? totalPoints / tieCount : 0;

        // Assign same place and average points to all tied entries
        for (const lineup of tiedEntries) {
          const finalTime = lineup.overrideTime ?? lineup.seedTime;
          const finalTimeSeconds = lineup.overrideTimeSeconds ?? lineup.seedTimeSeconds;

          await prisma.meetLineup.update({
            where: { id: lineup.id },
            data: {
              place: currentPlace, // All tied entries get the same place
              points: averagePoints,
              finalTime,
              finalTimeSeconds,
            },
          });
        }

        // Move to next place after all tied entries
        currentPlace += tieCount;
        i = j - 1; // Adjust loop index (will be incremented by for loop)
      }
    }

    // Process relay events
    for (const [eventId, relays] of Object.entries(relaysByEvent)) {
      if (relays.length === 0) continue;

      // Sort by time (use override if present, otherwise seed)
      const sorted = [...relays].sort((a, b) => {
        // Use override time if present, otherwise use seed time
        let aTime = a.overrideTimeSeconds ?? a.seedTimeSeconds;
        let bTime = b.overrideTimeSeconds ?? b.seedTimeSeconds;

        // If timeSeconds is null, try to parse from time string
        if (aTime === null) {
          const timeStr = a.overrideTime ?? a.seedTime;
          if (timeStr) {
            aTime = parseTimeToSeconds(timeStr);
          }
        }
        if (bTime === null) {
          const timeStr = b.overrideTime ?? b.seedTime;
          if (timeStr) {
            bTime = parseTimeToSeconds(timeStr);
          }
        }

        // Default to 0 if still null
        aTime = aTime ?? 0;
        bTime = bTime ?? 0;

        return aTime - bTime;
      });

      // Assign places and calculate points (handling ties)
      let currentPlace = 1;
      for (let i = 0; i < sorted.length; i++) {
        // Find all entries with the same time (ties)
        const currentTime = (() => {
          const overrideTime = sorted[i].overrideTimeSeconds ?? sorted[i].seedTimeSeconds;
          if (overrideTime !== null) return overrideTime;
          const timeStr = sorted[i].overrideTime ?? sorted[i].seedTime;
          return timeStr ? parseTimeToSeconds(timeStr) : 0;
        })();

        const tiedEntries: typeof sorted = [sorted[i]];
        let j = i + 1;
        while (j < sorted.length) {
          const nextTime = (() => {
            const overrideTime = sorted[j].overrideTimeSeconds ?? sorted[j].seedTimeSeconds;
            if (overrideTime !== null) return overrideTime;
            const timeStr = sorted[j].overrideTime ?? sorted[j].seedTime;
            return timeStr ? parseTimeToSeconds(timeStr) : 0;
          })();

          // Check if times are equal (accounting for floating point precision)
          // Use a very small tolerance (0.001s = 1ms) to handle floating point rounding
          // but not so large that it incorrectly ties times that differ by 0.01s (hundredths)
          if (Math.abs(currentTime - nextTime) < 0.001) {
            tiedEntries.push(sorted[j]);
            j++;
          } else {
            break;
          }
        }

        // Calculate average points for tied entries
        const tieCount = tiedEntries.length;
        const placesOccupied = Array.from({ length: tieCount }, (_, idx) => currentPlace + idx);
        const totalPoints = placesOccupied.reduce((sum, place) => {
          return sum + (place <= meet.scoringPlaces ? (relayScoring[place.toString()] || 0) : 0);
        }, 0);
        const averagePoints = tieCount > 0 ? totalPoints / tieCount : 0;

        // Assign same place and average points to all tied entries
        for (const relay of tiedEntries) {
          const finalTime = relay.overrideTime ?? relay.seedTime;
          const finalTimeSeconds = relay.overrideTimeSeconds ?? relay.seedTimeSeconds;

          await prisma.relayEntry.update({
            where: { id: relay.id },
            data: {
              place: currentPlace, // All tied entries get the same place
              points: averagePoints,
              finalTime,
              finalTimeSeconds,
            },
          });
        }

        // Move to next place after all tied entries
        currentPlace += tieCount;
        i = j - 1; // Adjust loop index (will be incremented by for loop)
      }
    }

    // Recalculate team scores
    const meetTeams = await prisma.meetTeam.findMany({
      where: { meetId: meetId },
      include: {
        team: true,
      },
    });

    for (const meetTeam of meetTeams) {
      const selectedAthletes = meetTeam.selectedAthletes
        ? (JSON.parse(meetTeam.selectedAthletes) as string[])
        : [];
      const mt = meetTeam as typeof meetTeam & { testSpotAthleteIds?: string | null; testSpotScoringAthleteId?: string | null };
      const testSpotAthleteIds = mt.testSpotAthleteIds
        ? (JSON.parse(mt.testSpotAthleteIds) as string[])
        : [];
      let testSpotScoringAthleteId = mt.testSpotScoringAthleteId;
      if (testSpotAthleteIds.length > 0 && (!testSpotScoringAthleteId || !testSpotAthleteIds.includes(testSpotScoringAthleteId))) {
        testSpotScoringAthleteId = testSpotAthleteIds[0];
      }
      const scoringSet = getScoringAthleteIdSet(
        selectedAthletes,
        testSpotAthleteIds,
        testSpotScoringAthleteId ?? null
      );

      // Get all lineups for this team
      const teamLineups = await prisma.meetLineup.findMany({
        where: {
          meetId: meetId,
          athlete: {
            teamId: meetTeam.teamId,
          },
        },
        include: {
          event: true,
        },
      });

      // Get all relays for this team
      const teamRelays = await prisma.relayEntry.findMany({
        where: {
          meetId: meetId,
          teamId: meetTeam.teamId,
        },
      });

      // Calculate scores by type (only scoring athletes count toward team total)
      const individualEntries = teamLineups.filter(
        (l) => l.event.eventType === "individual" && scoringSet.has(l.athleteId)
      );
      const divingEntries = teamLineups.filter(
        (l) => l.event.eventType === "diving" && scoringSet.has(l.athleteId)
      );

      const individualScore = individualEntries.reduce(
        (sum, entry) => sum + (entry.points || 0),
        0
      );
      const divingScore = divingEntries.reduce(
        (sum, entry) => sum + (entry.points || 0),
        0
      );
      const relayScore = teamRelays.reduce(
        (sum, relay) => sum + (relay.points || 0),
        0
      );
      const totalScore = individualScore + divingScore + relayScore;

      // Update meet team scores (and persist default test-spot scorer if we had to pick one)
      const updateData: {
        individualScore: number;
        divingScore: number;
        relayScore: number;
        totalScore: number;
        testSpotScoringAthleteId?: string;
      } = {
        individualScore,
        divingScore,
        relayScore,
        totalScore,
      };
      if (testSpotAthleteIds.length > 0 && testSpotScoringAthleteId && mt.testSpotScoringAthleteId !== testSpotScoringAthleteId) {
        updateData.testSpotScoringAthleteId = testSpotScoringAthleteId;
      }
      await prisma.meetTeam.update({
        where: { id: meetTeam.id },
        data: updateData,
      });

      // Sensitivity analysis: compute better/worse team totals for this team's sensitivity athlete
      const sensAthleteId = (meetTeam as { sensitivityAthleteId?: string | null }).sensitivityAthleteId;
      const sensPct = (meetTeam as { sensitivityPercent?: number | null }).sensitivityPercent;
      if (sensAthleteId && sensPct != null && sensPct > 0) {
        const sensitivityLineups = await prisma.meetLineup.findMany({
          where: { meetId },
          include: { athlete: true, event: true },
        });
        const sensAthleteLineups = sensitivityLineups.filter((l) => l.athleteId === sensAthleteId && l.athlete.teamId === meetTeam.teamId);
        if (sensAthleteLineups.length === 0) {
          await prisma.meetTeam.update({
            where: { id: meetTeam.id },
            data: {
              sensitivityTotalScoreBetter: null,
              sensitivityTotalScoreWorse: null,
              sensitivityAthletePointsBaseline: null,
              sensitivityAthletePointsBetter: null,
              sensitivityAthletePointsWorse: null,
            } as Record<string, unknown>,
          });
          // Clear any previously set sensitivity place/points on this team's lineups
          await prisma.meetLineup.updateMany({
            where: { meetId, athleteId: sensAthleteId },
            data: {
              sensitivityPlaceBetter: null,
              sensitivityPointsBetter: null,
              sensitivityPlaceWorse: null,
              sensitivityPointsWorse: null,
            } as Record<string, unknown>,
          });
        } else {
          const pct = sensPct / 100;
          let athletePointsBaseline = 0;
          let athletePointsBetter = 0;
          let athletePointsWorse = 0;
          const lineupsByEventSens: Record<string, typeof sensitivityLineups> = {};
          sensitivityLineups.forEach((l) => {
            if (!lineupsByEventSens[l.eventId]) lineupsByEventSens[l.eventId] = [];
            lineupsByEventSens[l.eventId].push(l);
          });
          const getTime = (l: { overrideTimeSeconds?: number | null; seedTimeSeconds?: number | null; overrideTime?: string | null; seedTime?: string | null }) => {
            const sec = l.overrideTimeSeconds ?? l.seedTimeSeconds;
            if (sec != null) return sec;
            const str = l.overrideTime ?? l.seedTime;
            return str ? parseTimeToSeconds(str) : 0;
          };
          const lineupUpdates: { id: string; sensitivityPlaceBetter: number; sensitivityPointsBetter: number; sensitivityPlaceWorse: number; sensitivityPointsWorse: number }[] = [];
          for (const lineup of sensAthleteLineups) {
            athletePointsBaseline += lineup.points ?? 0;
            const eventType = lineup.event.eventType;
            const eventLineups = lineupsByEventSens[lineup.eventId] ?? [];
            const baseTime = getTime(lineup);
            const isDiving = eventType === "diving";
            const betterTime = isDiving ? baseTime * (1 + pct) : baseTime * (1 - pct);
            const worseTime = isDiving ? baseTime * (1 - pct) : baseTime * (1 + pct);
            let sensitivityPlaceBetter = 0;
            let sensitivityPointsBetter = 0;
            let sensitivityPlaceWorse = 0;
            let sensitivityPointsWorse = 0;
            for (const variant of ["better", "worse"] as const) {
              const substituteTime = variant === "better" ? betterTime : worseTime;
              const sorted = [...eventLineups].map((l) => ({
                ...l,
                _sortTime: l.id === lineup.id ? substituteTime : getTime(l),
              }));
              sorted.sort((a, b) => {
                if (isDiving) return b._sortTime - a._sortTime;
                return a._sortTime - b._sortTime;
              });
              const place = sorted.findIndex((x) => x.id === lineup.id) + 1;
              const pts = place <= meet.scoringPlaces ? (individualScoring[place.toString()] || 0) : 0;
              if (variant === "better") {
                athletePointsBetter += pts;
                sensitivityPlaceBetter = place;
                sensitivityPointsBetter = pts;
              } else {
                athletePointsWorse += pts;
                sensitivityPlaceWorse = place;
                sensitivityPointsWorse = pts;
              }
            }
            lineupUpdates.push({
              id: lineup.id,
              sensitivityPlaceBetter,
              sensitivityPointsBetter,
              sensitivityPlaceWorse,
              sensitivityPointsWorse,
            });
          }
          const totalScoreBetter = totalScore - athletePointsBaseline + athletePointsBetter;
          const totalScoreWorse = totalScore - athletePointsBaseline + athletePointsWorse;
          await prisma.meetTeam.update({
            where: { id: meetTeam.id },
            data: {
              sensitivityTotalScoreBetter: totalScoreBetter,
              sensitivityTotalScoreWorse: totalScoreWorse,
              sensitivityAthletePointsBaseline: athletePointsBaseline,
              sensitivityAthletePointsBetter: athletePointsBetter,
              sensitivityAthletePointsWorse: athletePointsWorse,
            } as Record<string, unknown>,
          });
          for (const u of lineupUpdates) {
            await prisma.meetLineup.update({
              where: { id: u.id },
              data: {
                sensitivityPlaceBetter: u.sensitivityPlaceBetter,
                sensitivityPointsBetter: u.sensitivityPointsBetter,
                sensitivityPlaceWorse: u.sensitivityPlaceWorse,
                sensitivityPointsWorse: u.sensitivityPointsWorse,
              } as Record<string, unknown>,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Meet simulated successfully",
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error("Error simulating meet:", error);
    return NextResponse.json(
      { error: error.message || "Failed to simulate meet" },
      { status: 500 }
    );
  }
}
