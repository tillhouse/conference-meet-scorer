import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const saveLineupSchema = z.object({
  lineups: z.record(z.array(z.string())), // { athleteId: [eventId1, eventId2, ...] }
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string; teamId: string }> }
) {
  try {
    const { meetId, teamId } = await params;

    // Get existing lineups for this team in this meet
    const lineups = await prisma.meetLineup.findMany({
      where: {
        meetId,
        athlete: {
          teamId,
        },
      },
      select: {
        athleteId: true,
        eventId: true,
      },
    });

    // Group by athlete
    const lineupsByAthlete: Record<string, string[]> = {};
    lineups.forEach((lineup) => {
      if (!lineupsByAthlete[lineup.athleteId]) {
        lineupsByAthlete[lineup.athleteId] = [];
      }
      lineupsByAthlete[lineup.athleteId].push(lineup.eventId);
    });

    return NextResponse.json({ lineups: lineupsByAthlete });
  } catch (error) {
    console.error("Error fetching lineups:", error);
    return NextResponse.json(
      { error: "Failed to fetch lineups" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string; teamId: string }> }
) {
  try {
    const { meetId, teamId } = await params;
    const body = await request.json();
    const data = saveLineupSchema.parse(body);

    // Verify meet exists
    const meet = await prisma.meet.findUnique({
      where: { id: meetId },
    });

    if (!meet) {
      return NextResponse.json(
        { error: "Meet not found" },
        { status: 404 }
      );
    }

    // Get all athletes and events to validate
    const athleteIds = Object.keys(data.lineups);
    const athletes = await prisma.athlete.findMany({
      where: {
        id: { in: athleteIds },
        teamId,
      },
    });

    if (athletes.length !== athleteIds.length) {
      return NextResponse.json(
        { error: "Some athletes not found or don't belong to this team" },
        { status: 400 }
      );
    }

    const selectedEvents = meet.selectedEvents
      ? (JSON.parse(meet.selectedEvents) as string[])
      : [];
    const events = await prisma.event.findMany({
      where: {
        id: { in: selectedEvents },
      },
    });

    // Validate event limits for each athlete
    for (const [athleteId, eventIds] of Object.entries(data.lineups)) {
      const athlete = athletes.find((a) => a.id === athleteId);
      if (!athlete) continue;

      const athleteEvents = events.filter((e) => eventIds.includes(e.id));
      const indivEvents = athleteEvents.filter((e) => e.eventType === "individual");
      const divingEvents = athleteEvents.filter((e) => e.eventType === "diving");

      if (athlete.isDiver) {
        if (divingEvents.length > meet.maxDivingEvents) {
          return NextResponse.json(
            {
              error: `${athlete.firstName} ${athlete.lastName} exceeds diving event limit (${divingEvents.length} > ${meet.maxDivingEvents})`,
            },
            { status: 400 }
          );
        }
      } else {
        if (indivEvents.length > meet.maxIndivEvents) {
          return NextResponse.json(
            {
              error: `${athlete.firstName} ${athlete.lastName} exceeds individual event limit (${indivEvents.length} > ${meet.maxIndivEvents})`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Delete existing lineups for this team
    await prisma.meetLineup.deleteMany({
      where: {
        meetId,
        athlete: {
          teamId,
        },
      },
    });

    // Create new lineups
    const lineupsToCreate = [];
    for (const [athleteId, eventIds] of Object.entries(data.lineups)) {
      for (const eventId of eventIds) {
        const athlete = athletes.find((a) => a.id === athleteId);
        const event = events.find((e) => e.id === eventId);
        if (!athlete || !event) continue;

        // Get athlete's time for this event
        const athleteEvent = await prisma.athleteEvent.findFirst({
          where: {
            athleteId: athlete.id,
            eventId: event.id,
            isRelaySplit: false,
          },
        });

        lineupsToCreate.push({
          meetId,
          athleteId,
          eventId,
          seedTime: athleteEvent?.time || null,
          seedTimeSeconds: athleteEvent?.timeSeconds || null,
        });
      }
    }

    if (lineupsToCreate.length > 0) {
      await prisma.meetLineup.createMany({
        data: lineupsToCreate,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Lineups saved successfully",
      count: lineupsToCreate.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error saving lineups:", error);
    return NextResponse.json(
      { error: "Failed to save lineups" },
      { status: 500 }
    );
  }
}
