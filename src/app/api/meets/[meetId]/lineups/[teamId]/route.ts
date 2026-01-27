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
    
    console.log(`[Lineup Save] Received request for meet ${meetId}, team ${teamId}`);
    console.log(`[Lineup Save] Request body:`, JSON.stringify(body, null, 2));
    
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

    // Get all events that are being used (not just selected events)
    const allEventIds = new Set<string>();
    Object.values(data.lineups).forEach((eventIds) => {
      eventIds.forEach((eventId) => allEventIds.add(eventId));
    });

    console.log(`[Lineup Save] Received ${Object.keys(data.lineups).length} athletes with lineups`);
    console.log(`[Lineup Save] Unique event IDs requested:`, Array.from(allEventIds));

    // Fetch all events being used
    const events = await prisma.event.findMany({
      where: {
        id: { in: Array.from(allEventIds) },
      },
    });

    console.log(`[Lineup Save] Found ${events.length} events in database:`, events.map(e => ({ id: e.id, name: e.name })));

    // Create any missing events
    const missingEventIds = Array.from(allEventIds).filter(
      (id) => !events.some((e) => e.id === id)
    );
    if (missingEventIds.length > 0) {
      // Try to find events by name if they exist
      const eventsByName = await prisma.event.findMany({
        where: {
          name: { in: missingEventIds },
        },
      });

      // Create any events that still don't exist
      const eventsToCreate = missingEventIds
        .filter((id) => !eventsByName.some((e) => e.name === id))
        .map((name) => ({
          name,
          fullName: name,
          eventType: name.includes("Relay") || name.includes("MR") || name.includes("FR")
            ? "relay"
            : name.includes("1M") || name.includes("3M") || name.includes("Platform")
            ? "diving"
            : "individual",
          sortOrder: 0,
        }));

      if (eventsToCreate.length > 0) {
        await prisma.event.createMany({
          data: eventsToCreate,
          skipDuplicates: true,
        });
      }

      // Fetch all events again including newly created ones
      const allEvents = await prisma.event.findMany({
        where: {
          OR: [
            { id: { in: Array.from(allEventIds) } },
            { name: { in: Array.from(allEventIds) } },
          ],
        },
      });
      events.push(...allEvents.filter((e) => !events.some((ex) => ex.id === e.id)));
    }

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
    const skippedLineups: string[] = [];
    
    console.log(`[Lineup Save] Processing ${Object.keys(data.lineups).length} athletes`);
    
    for (const [athleteId, eventIds] of Object.entries(data.lineups)) {
      const athlete = athletes.find((a) => a.id === athleteId);
      if (!athlete) {
        console.warn(`[Lineup Save] Athlete ${athleteId} not found in team`);
        continue;
      }
      
      for (const eventId of eventIds) {
        // Find event by ID or name
        const event = events.find((e) => e.id === eventId || e.name === eventId);
        if (!event) {
          skippedLineups.push(`${athlete.firstName} ${athlete.lastName}/${eventId}: event not found`);
          console.warn(`[Lineup Save] Event not found: ${eventId} (available events: ${events.map(e => e.id).join(', ')})`);
          continue;
        }

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
        skipDuplicates: true,
      });
    }

    console.log(`Created ${lineupsToCreate.length} lineups, skipped ${skippedLineups.length}`);
    if (skippedLineups.length > 0) {
      console.log("Skipped lineups:", skippedLineups);
    }

    return NextResponse.json({
      success: true,
      message: "Lineups saved successfully",
      count: lineupsToCreate.length,
      skipped: skippedLineups.length,
      skippedDetails: skippedLineups,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`[Lineup Save] Validation error:`, error.errors);
      return NextResponse.json(
        { 
          error: "Invalid data", 
          details: error.errors,
          received: body,
        },
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
