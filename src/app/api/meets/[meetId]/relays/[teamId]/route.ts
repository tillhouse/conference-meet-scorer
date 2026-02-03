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

    // Parse members, leg times, and useRelaySplits from JSON
    const relays = relayEntries.map((entry) => {
      const members = entry.members ? (JSON.parse(entry.members) as string[]) : [null, null, null, null];
      const legTimes = entry.legTimes ? (JSON.parse(entry.legTimes) as (string | null)[]) : [null, null, null, null];
      const useRelaySplits = entry.useRelaySplits ? (JSON.parse(entry.useRelaySplits) as boolean[]) : [false, true, true, true];
      
      return {
        eventId: entry.event.name, // Return event name, not database ID
        eventDbId: entry.eventId, // Keep database ID for reference
        members,
        times: legTimes,
        useRelaySplits,
      };
    });

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
    console.log("Received relay save request:", { meetId, teamId, relayCount: body.relays?.length });
    
    const data = saveRelaySchema.parse(body);
    console.log("Parsed relay data:", { relayCount: data.relays.length });

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
    // relay.eventId is the event name (e.g., "200 Medley Relay"), not the database ID
    for (const relay of data.relays) {
      let event = await prisma.event.findFirst({
        where: { name: relay.eventId },
      });

      if (!event) {
        // Create the relay event if it doesn't exist
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

      // relay.eventId is the event name (e.g., "200 Medley Relay")
      let event = await prisma.event.findFirst({
        where: { name: relay.eventId },
      });
      if (!event) {
        console.log(`Event not found, creating: ${relay.eventId}`);
        // Try to create it
        try {
          event = await prisma.event.create({
            data: {
              name: relay.eventId,
              fullName: relay.eventId,
              eventType: "relay",
              sortOrder: 0,
            },
          });
          console.log(`Created missing event: ${relay.eventId} with ID: ${event.id}`);
        } catch (createError) {
          console.error(`Failed to create event ${relay.eventId}:`, createError);
          continue;
        }
      }

      entriesToCreate.push({
        meetId,
        teamId,
        eventId: event.id,
        seedTime: totalTime,
        seedTimeSeconds: totalSeconds,
        members: JSON.stringify(relay.members),
        legTimes: JSON.stringify(relay.times),
        useRelaySplits: JSON.stringify(relay.useRelaySplits),
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { 
        error: "Failed to save relays",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string; teamId: string }> }
) {
  try {
    const { meetId, teamId } = await params;

    // Delete all relay entries for this team
    await prisma.relayEntry.deleteMany({
      where: {
        meetId,
        teamId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Relays cleared successfully",
    });
  } catch (error) {
    console.error("Error clearing relays:", error);
    return NextResponse.json(
      { error: "Failed to clear relays" },
      { status: 500 }
    );
  }
}
