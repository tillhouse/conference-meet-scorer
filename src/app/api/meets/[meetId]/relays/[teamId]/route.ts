import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { parseTimeToSeconds } from "@/lib/utils";

const saveRelaySchema = z.object({
  relays: z.array(
    z.object({
      eventId: z.string(),
      members: z.array(z.string().nullable()),
      times: z.array(z.string().nullable()),
      useRelaySplits: z.array(z.boolean()),
    })
  ),
  correctionFactor: z.number().default(0.5),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string; teamId: string }> }
) {
  try {
    const { meetId, teamId } = await params;

    // Get existing relay entries for this team
    const relayEntries = await prisma.relayEntry.findMany({
      where: {
        meetId,
        teamId,
      },
      include: {
        event: true,
      },
    });

    // Parse members from JSON
    const relays = relayEntries.map((entry) => ({
      eventId: entry.eventId,
      members: entry.members ? (JSON.parse(entry.members) as string[]) : [null, null, null, null],
      times: entry.seedTime ? [entry.seedTime] : [null, null, null, null], // For now, store total time
      useRelaySplits: [false, true, true, true], // Default, could be stored separately if needed
    }));

    return NextResponse.json({ relays });
  } catch (error) {
    console.error("Error fetching relays:", error);
    return NextResponse.json(
      { error: "Failed to fetch relays" },
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
    const data = saveRelaySchema.parse(body);

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

    // Validate relay limit per athlete
    const athleteRelayCount: Record<string, number> = {};
    data.relays.forEach((relay) => {
      relay.members.forEach((athleteId) => {
        if (athleteId) {
          athleteRelayCount[athleteId] = (athleteRelayCount[athleteId] || 0) + 1;
        }
      });
    });

    const violations: string[] = [];
    for (const [athleteId, count] of Object.entries(athleteRelayCount)) {
      if (count > meet.maxRelays) {
        const athlete = await prisma.athlete.findUnique({
          where: { id: athleteId },
        });
        if (athlete) {
          violations.push(
            `${athlete.firstName} ${athlete.lastName}: ${count} relays (max ${meet.maxRelays})`
          );
        }
      }
    }

    if (violations.length > 0) {
      return NextResponse.json(
        {
          error: "Relay limit violations",
          violations,
        },
        { status: 400 }
      );
    }

    // Ensure relay events exist
    for (const relay of data.relays) {
      let event = await prisma.event.findUnique({
        where: { id: relay.eventId },
      });

      if (!event) {
        // Try to find by name
        event = await prisma.event.findFirst({
          where: { name: relay.eventId },
        });
      }

      if (!event) {
        // Create the relay event
        event = await prisma.event.create({
          data: {
            name: relay.eventId,
            fullName: relay.eventId,
            eventType: "relay",
            sortOrder: 0,
          },
        });
      }
    }

    // Delete existing relay entries for this team
    await prisma.relayEntry.deleteMany({
      where: {
        meetId,
        teamId,
      },
    });

    // Create new relay entries
    const entriesToCreate = [];
    for (const relay of data.relays) {
      // Calculate total relay time from individual leg times
      const legTimes = relay.times.filter((t) => t !== null) as string[];
      let totalTime: string | null = null;
      let totalSeconds: number | null = null;

      if (legTimes.length === 4) {
        const seconds = legTimes.reduce((sum, time) => sum + parseTimeToSeconds(time), 0);
        totalSeconds = seconds;
        // Format total time (could be > 1 minute)
        if (seconds < 60) {
          totalTime = seconds.toFixed(2);
        } else {
          const mins = Math.floor(seconds / 60);
          const secs = (seconds % 60).toFixed(2).padStart(5, "0");
          totalTime = `${mins}:${secs}`;
        }
      }

      // Get event ID (might be name or ID)
      let event = await prisma.event.findUnique({
        where: { id: relay.eventId },
      });
      if (!event) {
        event = await prisma.event.findFirst({
          where: { name: relay.eventId },
        });
      }
      if (!event) continue;

      entriesToCreate.push({
        meetId,
        teamId,
        eventId: event.id,
        seedTime: totalTime,
        seedTimeSeconds: totalSeconds,
        members: JSON.stringify(relay.members),
      });
    }

    if (entriesToCreate.length > 0) {
      await prisma.relayEntry.createMany({
        data: entriesToCreate,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Relays saved successfully",
      count: entriesToCreate.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error saving relays:", error);
    return NextResponse.json(
      { error: "Failed to save relays" },
      { status: 500 }
    );
  }
}
