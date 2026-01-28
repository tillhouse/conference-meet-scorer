import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const saveLineupSchema = z.object({
  lineups: z.record(z.string(), z.array(z.string()).min(1)), // { athleteId: [eventId1, eventId2, ...] } - at least one event per athlete
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
  let body: any = null;
  try {
    const { meetId, teamId } = await params;
    body = await request.json();
    
    console.log(`[Lineup Save] Received request for meet ${meetId}, team ${teamId}`);
    console.log(`[Lineup Save] Request body:`, JSON.stringify(body, null, 2));
    console.log(`[Lineup Save] Request body type:`, typeof body);
    console.log(`[Lineup Save] lineups type:`, typeof body?.lineups);
    console.log(`[Lineup Save] lineups keys:`, body?.lineups ? Object.keys(body.lineups) : 'none');
    if (body?.lineups) {
      Object.entries(body.lineups).forEach(([key, value]) => {
        console.log(`[Lineup Save]   ${key}:`, typeof value, Array.isArray(value) ? `array[${(value as any[]).length}]` : value);
      });
    }
    
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
          const lowerName = name.toLowerCase();
          const eventType = lowerName.includes("relay")
            ? "relay"
            : lowerName.includes("diving") || lowerName.includes("1m") || lowerName.includes("3m") || lowerName.includes("platform")
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
      // Add new events that weren't already in the events array
      allEvents.forEach((e) => {
        if (!events.some((ex) => ex.id === e.id)) {
          events.push(e);
        }
      });
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
    // First, get the count of existing lineups to verify deletion
    const existingLineupsCount = await prisma.meetLineup.count({
      where: {
        meetId,
        athlete: {
          teamId,
        },
      },
    });
    
    console.log(`[Lineup Save] Found ${existingLineupsCount} existing lineups for team ${teamId} in meet ${meetId}`);
    
    const deleteResult = await prisma.meetLineup.deleteMany({
      where: {
        meetId,
        athlete: {
          teamId,
        },
      },
    });
    
    console.log(`[Lineup Save] Deleted ${deleteResult.count} existing lineups for team ${teamId}`);
    
    // Verify deletion worked
    if (existingLineupsCount > 0 && deleteResult.count === 0) {
      console.error(`[Lineup Save] WARNING: Expected to delete ${existingLineupsCount} lineups but deleted 0. This may indicate a data issue.`);
    }

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
        let seedTime: string | null = null;
        let seedTimeSeconds: number | null = null;
        
        try {
          const athleteEvent = await prisma.athleteEvent.findFirst({
            where: {
              athleteId: athlete.id,
              eventId: event.id,
              isRelaySplit: false,
            },
          });
          seedTime = athleteEvent?.time || null;
          seedTimeSeconds = athleteEvent?.timeSeconds || null;
        } catch (e) {
          console.warn(`[Lineup Save] Could not fetch athlete event time for ${athlete.firstName} ${athlete.lastName} in ${event.name}:`, e);
          // Continue without seed time
        }

        lineupsToCreate.push({
          meetId,
          athleteId,
          eventId: event.id, // Use the database event ID, not the name
          seedTime,
          seedTimeSeconds,
        });
        
        console.log(`[Lineup Save] Adding lineup: athlete=${athlete.firstName} ${athlete.lastName}, event=${event.name} (${event.id})`);
      }
    }

    let createdCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    
    if (lineupsToCreate.length > 0) {
      // Prisma 6 doesn't support skipDuplicates, so we'll create them individually
      // and catch any unique constraint violations (duplicates)
      for (const lineup of lineupsToCreate) {
        try {
          await prisma.meetLineup.create({
            data: lineup,
          });
          createdCount++;
        } catch (error: any) {
          // If it's a unique constraint violation, it's a duplicate - skip it
          if (error?.code === 'P2002') {
            console.warn(`[Lineup Save] Duplicate lineup skipped: athlete=${lineup.athleteId}, event=${lineup.eventId}`);
            duplicateCount++;
            continue;
          }
          // Otherwise, log and count the error but continue
          console.error(`[Lineup Save] Error creating lineup for athlete=${lineup.athleteId}, event=${lineup.eventId}:`, error);
          errorCount++;
        }
      }
    }
    
    console.log(`[Lineup Save] Summary: Created ${createdCount}, Duplicates ${duplicateCount}, Errors ${errorCount}, Skipped (not found) ${skippedLineups.length}`);

    if (skippedLineups.length > 0) {
      console.log("Skipped lineups (events not found):", skippedLineups);
    }

    return NextResponse.json({
      success: true,
      message: "Lineups saved successfully",
      count: createdCount,
      attempted: lineupsToCreate.length,
      duplicates: duplicateCount,
      errors: errorCount,
      skipped: skippedLineups.length,
      skippedDetails: skippedLineups,
      deleted: deleteResult.count,
    });
  } catch (error) {
    console.error("=".repeat(50));
    console.error("[Lineup Save] ERROR CAUGHT:");
    console.error("Error type:", error?.constructor?.name);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("=".repeat(50));
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: "Invalid data", 
          details: error.errors,
          received: body,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: "Failed to save lineups",
        message: error instanceof Error ? error.message : String(error),
        type: error?.constructor?.name || typeof error,
      },
      { status: 500 }
    );
  }
}
