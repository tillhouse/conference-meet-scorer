import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTimeToSeconds } from "@/lib/utils";
import { z } from "zod";

const createEventSchema = z.object({
  athleteId: z.string().min(1, "Athlete ID is required"),
  eventName: z.string().min(1, "Event name is required"),
  time: z.string().min(1, "Time is required"),
  isRelaySplit: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createEventSchema.parse(body);

    // Verify athlete exists
    const athlete = await prisma.athlete.findUnique({
      where: { id: data.athleteId },
    });

    if (!athlete) {
      return NextResponse.json(
        { error: "Athlete not found" },
        { status: 404 }
      );
    }

    // Find or create event
    let event = await prisma.event.findUnique({
      where: { name: data.eventName },
    });

    if (!event) {
      // Determine event type
      const isDivingEvent =
        data.eventName.includes("1M") ||
        data.eventName.includes("3M") ||
        data.eventName.toLowerCase().includes("platform");
      const eventType = isDivingEvent ? "diving" : "individual";

      event = await prisma.event.create({
        data: {
          name: data.eventName,
          fullName: data.eventName,
          eventType,
          sortOrder: 0,
        },
      });
    }

    // Parse time to seconds
    const timeSeconds = parseTimeToSeconds(data.time);

    // Find or create athlete event (can have same event as both individual and relay split)
    const existingAthleteEvent = await prisma.athleteEvent.findFirst({
      where: {
        athleteId: athlete.id,
        eventId: event.id,
        isRelaySplit: data.isRelaySplit,
      },
    });

    if (existingAthleteEvent) {
      // Update existing
      await prisma.athleteEvent.update({
        where: { id: existingAthleteEvent.id },
        data: {
          time: data.time,
          timeSeconds,
          source: "manual",
        },
      });
    } else {
      // Create new
      await prisma.athleteEvent.create({
        data: {
          athleteId: athlete.id,
          eventId: event.id,
          time: data.time,
          timeSeconds,
          isRelaySplit: data.isRelaySplit,
          source: "manual",
        },
      });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating athlete event:", error);
    return NextResponse.json(
      { error: "Failed to create athlete event" },
      { status: 500 }
    );
  }
}
