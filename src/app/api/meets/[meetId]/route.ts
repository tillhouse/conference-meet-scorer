import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateMeetSchema = z.object({
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
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string }> }
) {
  try {
    const { meetId } = await params;

    const meet = await prisma.meet.findUnique({
      where: { id: meetId },
      include: {
        meetTeams: {
          include: {
            team: true,
          },
        },
      },
    });

    if (!meet) {
      return NextResponse.json({ error: "Meet not found" }, { status: 404 });
    }

    // Serialize date properly for JSON
    const serializedMeet = {
      ...meet,
      date: meet.date 
        ? (meet.date instanceof Date ? meet.date.toISOString() : meet.date)
        : null,
      createdAt: meet.createdAt instanceof Date ? meet.createdAt.toISOString() : meet.createdAt,
      updatedAt: meet.updatedAt instanceof Date ? meet.updatedAt.toISOString() : meet.updatedAt,
    };

    return NextResponse.json(serializedMeet);
  } catch (error) {
    console.error("Error fetching meet:", error);
    return NextResponse.json(
      { error: "Failed to fetch meet" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string }> }
) {
  try {
    const { meetId } = await params;
    const body = await request.json();
    const data = updateMeetSchema.parse(body);

    // Verify meet exists
    const existingMeet = await prisma.meet.findUnique({
      where: { id: meetId },
      include: {
        meetTeams: true,
      },
    });

    if (!existingMeet) {
      return NextResponse.json({ error: "Meet not found" }, { status: 404 });
    }

    // Ensure all selected events exist in the database
    const eventNames: string[] = [];
    const eventIds: string[] = [];

    // Separate IDs from names
    for (const item of data.eventIds) {
      if (item.length > 10 || item.includes("-")) {
        eventIds.push(item);
      } else {
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

    // Create missing events
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

    // Process eventOrder if provided (convert event names to IDs, similar to create route)
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

    // Update the meet
    const meet = await prisma.meet.update({
      where: { id: meetId },
      data: {
        name: data.name,
        date: data.date && data.date.trim() !== "" ? new Date(data.date) : null,
        location: data.location && data.location.trim() !== "" ? data.location : null,
        meetType: data.meetType,
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
        eventOrder: finalEventOrder ? JSON.stringify(finalEventOrder) : null,
      },
    });

    // Update meet teams - remove teams that are no longer selected
    const currentTeamIds = existingMeet.meetTeams.map((mt) => mt.teamId);
    const teamsToRemove = currentTeamIds.filter((teamId) => !data.teamIds.includes(teamId));
    const teamsToAdd = data.teamIds.filter((teamId) => !currentTeamIds.includes(teamId));

    // Remove teams
    if (teamsToRemove.length > 0) {
      await prisma.meetTeam.deleteMany({
        where: {
          meetId: meetId,
          teamId: { in: teamsToRemove },
        },
      });
    }

    // Add new teams
    if (teamsToAdd.length > 0) {
      await prisma.meetTeam.createMany({
        data: teamsToAdd.map((teamId) => ({
          meetId: meetId,
          teamId,
        })),
      });
    }

    return NextResponse.json(meet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.issues);
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating meet:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update meet", details: errorMessage },
      { status: 500 }
    );
  }
}
