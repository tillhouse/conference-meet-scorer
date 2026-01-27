import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTimeToSeconds, formatSecondsToTime } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string }> }
) {
  try {
    const { meetId } = await params;

    // Fetch the meet with all related data
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

      // Sort by seed time (fastest first for swimming, highest first for diving)
      const sorted = [...lineups].sort((a, b) => {
        let aTime = a.seedTimeSeconds;
        let bTime = b.seedTimeSeconds;

        // If seedTimeSeconds is null, try to parse from seedTime string
        if (aTime === null && a.seedTime) {
          aTime = parseTimeToSeconds(a.seedTime);
        }
        if (bTime === null && b.seedTime) {
          bTime = parseTimeToSeconds(b.seedTime);
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

      // Assign places and calculate points
      for (let i = 0; i < sorted.length; i++) {
        const lineup = sorted[i];
        const place = i + 1;
        const points = place <= meet.scoringPlaces ? (individualScoring[place.toString()] || 0) : 0;

        // Use seed time as final time for simulation
        const finalTime = lineup.seedTime;
        const finalTimeSeconds = lineup.seedTimeSeconds;

        await prisma.meetLineup.update({
          where: { id: lineup.id },
          data: {
            place,
            points,
            finalTime,
            finalTimeSeconds,
          },
        });
      }
    }

    // Process relay events
    for (const [eventId, relays] of Object.entries(relaysByEvent)) {
      if (relays.length === 0) continue;

      // Sort by seed time (fastest first)
      const sorted = [...relays].sort((a, b) => {
        let aTime = a.seedTimeSeconds;
        let bTime = b.seedTimeSeconds;

        // If seedTimeSeconds is null, try to parse from seedTime string
        if (aTime === null && a.seedTime) {
          aTime = parseTimeToSeconds(a.seedTime);
        }
        if (bTime === null && b.seedTime) {
          bTime = parseTimeToSeconds(b.seedTime);
        }

        // Default to 0 if still null
        aTime = aTime ?? 0;
        bTime = bTime ?? 0;

        return aTime - bTime;
      });

      // Assign places and calculate points
      for (let i = 0; i < sorted.length; i++) {
        const relay = sorted[i];
        const place = i + 1;
        const points = place <= meet.scoringPlaces ? (relayScoring[place.toString()] || 0) : 0;

        // Use seed time as final time for simulation
        const finalTime = relay.seedTime;
        const finalTimeSeconds = relay.seedTimeSeconds;

        await prisma.relayEntry.update({
          where: { id: relay.id },
          data: {
            place,
            points,
            finalTime,
            finalTimeSeconds,
          },
        });
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
    });
  } catch (error: any) {
    console.error("Error simulating meet:", error);
    return NextResponse.json(
      { error: error.message || "Failed to simulate meet" },
      { status: 500 }
    );
  }
}
