import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTimeToSeconds, formatSecondsToTime } from "@/lib/utils";

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
          const isEqual = eventType === "diving"
            ? Math.abs(currentTime - nextTime) < 0.01
            : Math.abs(currentTime - nextTime) < 0.01;

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
          if (Math.abs(currentTime - nextTime) < 0.01) {
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

      // Calculate scores by type
      const individualEntries = teamLineups.filter(
        (l) => l.event.eventType === "individual"
      );
      const divingEntries = teamLineups.filter(
        (l) => l.event.eventType === "diving"
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

      // Update meet team scores
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
