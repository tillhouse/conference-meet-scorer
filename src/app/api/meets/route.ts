import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createMeetSchema = z.object({
  name: z.string().min(1, "Meet name is required"),
  date: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  meetType: z.enum(["championship", "dual"]),
  maxAthletes: z.number().min(1),
  diverRatio: z.number().min(0).max(1),
  divingIncluded: z.boolean(),
  maxIndivEvents: z.number().min(1),
  maxRelays: z.number().min(1),
  maxDivingEvents: z.number().min(1),
  scoringPlaces: z.number().min(1),
  scoringStartPoints: z.number().min(1),
  relayMultiplier: z.number().min(1),
  individualScoring: z.string(),
  relayScoring: z.string(),
  teamIds: z.array(z.string()).min(1),
  eventIds: z.array(z.string()).min(1),
  eventOrder: z.string().nullable().optional(),
  teamAccountId: z.string().nullable().optional(), // Team Account that owns this meet
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("Received meet data:", JSON.stringify(body, null, 2));
    const data = createMeetSchema.parse(body);
    console.log("Parsed data:", JSON.stringify(data, null, 2));

    // Ensure all selected events exist in the database
    // eventIds might be actual IDs or event names (if events don't exist yet)
    const eventNames: string[] = [];
    const eventIds: string[] = [];

    // Separate IDs from names (IDs are typically longer and contain dashes, names are short like "50 FR")
    for (const item of data.eventIds) {
      if (item.length > 10 || item.includes("-")) {
        // Likely an actual ID
        eventIds.push(item);
      } else {
        // Likely an event name
        eventNames.push(item);
      }
    }

    // Find existing events by ID or name
    const existingEvents = await prisma.event.findMany({
      where: {
        OR: [
          ...(eventIds.length > 0 ? [{ id: { in: eventIds } }] : []),
          ...(eventNames.length > 0 ? [{ name: { in: eventNames } }] : []),
        ],
      },
    });

    const existingEventNames = new Set(existingEvents.map((e) => e.name));
    const existingEventIds = new Set(existingEvents.map((e) => e.id));

    // Create missing events (only those that are names and don't exist)
    const eventsToCreate = eventNames.filter((name) => !existingEventNames.has(name));
    if (eventsToCreate.length > 0) {
      await prisma.event.createMany({
        data: eventsToCreate.map((name) => {
          const lowerName = name.toLowerCase();
          const isDivingEvent = lowerName.includes("diving") || lowerName === "1m" || lowerName === "3m" || lowerName.includes("platform");
          const isRelayEvent = lowerName.includes("relay");
          let eventType = "individual";
          if (isDivingEvent) {
            eventType = "diving";
          } else if (isRelayEvent) {
            eventType = "relay";
          }
          return {
            name,
            fullName: name,
            eventType,
            sortOrder: 0,
          };
        }),
      });
    }

    // Get all event IDs (both existing and newly created)
    const allEvents = await prisma.event.findMany({
      where: {
        OR: [
          ...(eventIds.length > 0 ? [{ id: { in: eventIds } }] : []),
          ...(eventNames.length > 0 ? [{ name: { in: eventNames } }] : []),
        ],
      },
    });

    const finalEventIds = allEvents.map((e) => e.id);

    // Process eventOrder if provided (convert event names to IDs)
    let finalEventOrder: string[] | null = null;
    if (data.eventOrder) {
      try {
        const eventOrderArray = JSON.parse(data.eventOrder) as string[];
        const eventNameToId = new Map(allEvents.map((e) => [e.name, e.id]));
        finalEventOrder = eventOrderArray
          .map((item) => {
            // If it's already an ID (long string with dashes), use it
            if (item.length > 10 || item.includes("-")) {
              return item;
            }
            // Otherwise, it's a name - look it up
            return eventNameToId.get(item) || item;
          })
          .filter((id) => finalEventIds.includes(id)); // Only include events that are actually selected
      } catch (e) {
        // If parsing fails, ignore eventOrder
        console.warn("Failed to parse eventOrder:", e);
      }
    }

    // Determine teamId (for backward compatibility) and teamAccountId
    const primaryTeamId = data.teamIds[0]; // Use first team as primary
    const teamAccountId = data.teamAccountId || primaryTeamId; // Use provided teamAccountId or default to first team

    // Create the meet
    const meet = await prisma.meet.create({
      data: {
        name: data.name,
        date: data.date && data.date.trim() !== "" ? new Date(data.date) : null,
        location: data.location && data.location.trim() !== "" ? data.location : null,
        meetType: data.meetType,
        teamId: primaryTeamId, // Legacy field for backward compatibility
        teamAccountId: teamAccountId, // Link to Team Account
        maxAthletes: data.maxAthletes,
        diverRatio: data.diverRatio,
        divingIncluded: data.divingIncluded,
        maxIndivEvents: data.maxIndivEvents,
        maxRelays: data.maxRelays,
        maxDivingEvents: data.maxDivingEvents,
        scoringType: data.meetType === "championship" ? "championship" : "dual",
        scoringPlaces: data.scoringPlaces,
        scoringStartPoints: data.scoringStartPoints,
        relayMultiplier: data.relayMultiplier,
        individualScoring: data.individualScoring,
        relayScoring: data.relayScoring,
        selectedEvents: JSON.stringify(finalEventIds),
        eventOrder: finalEventOrder && finalEventOrder.length > 0 ? JSON.stringify(finalEventOrder) : null,
      },
    });

    // Create meet teams
    await prisma.meetTeam.createMany({
      data: data.teamIds.map((teamId) => ({
        meetId: meet.id,
        teamId,
      })),
    });

    return NextResponse.json(meet, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.issues);
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error creating meet:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create meet", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const meets = await prisma.meet.findMany({
      include: {
        meetTeams: {
          include: {
            team: true,
          },
        },
        _count: {
          select: {
            meetTeams: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(meets);
  } catch (error) {
    console.error("Error fetching meets:", error);
    return NextResponse.json(
      { error: "Failed to fetch meets" },
      { status: 500 }
    );
  }
}
