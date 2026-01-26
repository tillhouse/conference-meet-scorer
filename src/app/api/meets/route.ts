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
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createMeetSchema.parse(body);

    // Ensure all selected events exist in the database
    const eventNames = data.eventIds.filter((id) => !id.includes("-")); // Filter out IDs that are actually names
    const existingEvents = await prisma.event.findMany({
      where: {
        OR: [
          { id: { in: data.eventIds } },
          { name: { in: eventNames } },
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
          const isDivingEvent = name === "1M" || name === "3M" || name.toLowerCase().includes("platform");
          return {
            name,
            fullName: name,
            eventType: isDivingEvent ? "diving" : "individual",
            sortOrder: 0,
          };
        }),
      });
    }

    // Get all event IDs (both existing and newly created)
    const allEvents = await prisma.event.findMany({
      where: {
        OR: [
          { id: { in: data.eventIds.filter((id) => existingEventIds.has(id)) } },
          { name: { in: eventNames } },
        ],
      },
    });

    const finalEventIds = allEvents.map((e) => e.id);

    // Create the meet
    const meet = await prisma.meet.create({
      data: {
        name: data.name,
        date: data.date ? new Date(data.date) : null,
        location: data.location,
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
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating meet:", error);
    return NextResponse.json(
      { error: "Failed to create meet" },
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
