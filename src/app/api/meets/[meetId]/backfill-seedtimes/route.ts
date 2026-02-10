import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEventName } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string }> }
) {
  try {
    const { meetId } = await params;

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

    // Get all lineups that are missing seedTime
    const lineupsWithoutTime = await prisma.meetLineup.findMany({
      where: {
        meetId,
        OR: [
          { seedTime: null },
          { seedTimeSeconds: null },
        ],
      },
      include: {
        athlete: {
          include: {
            team: true,
          },
        },
        event: true,
      },
    });

    console.log(`[Backfill] Found ${lineupsWithoutTime.length} lineups without seedTime`);

    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const lineup of lineupsWithoutTime) {
      try {
        // First try to find by event ID
        let athleteEvent = await prisma.athleteEvent.findFirst({
          where: {
            athleteId: lineup.athleteId,
            eventId: lineup.eventId,
            isRelaySplit: false,
          },
          include: {
            event: true,
          },
        });

        // If not found by ID, try to find by normalized event name
        if (!athleteEvent) {
          const normalizedEventName = normalizeEventName(lineup.event.name);
          const allAthleteEvents = await prisma.athleteEvent.findMany({
            where: {
              athleteId: lineup.athleteId,
              isRelaySplit: false,
            },
            include: {
              event: true,
            },
          });

          // Try to find a match by normalized name
          athleteEvent = allAthleteEvents.find((ae) => {
            const normalizedAthleteEventName = normalizeEventName(ae.event.name);
            return normalizedAthleteEventName === normalizedEventName ||
                   normalizedAthleteEventName.toLowerCase() === normalizedEventName.toLowerCase();
          }) || null;
        }

        if (athleteEvent) {
          await prisma.meetLineup.update({
            where: { id: lineup.id },
            data: {
              seedTime: athleteEvent.time,
              seedTimeSeconds: athleteEvent.timeSeconds,
            },
          });
          updatedCount++;
        } else {
          skippedCount++;
          errors.push(`${lineup.athlete.firstName} ${lineup.athlete.lastName} - ${lineup.event.name}: No time found`);
        }
      } catch (error) {
        console.error(`[Backfill] Error updating lineup ${lineup.id}:`, error);
        errors.push(`${lineup.athlete.firstName} ${lineup.athlete.lastName} - ${lineup.event.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Backfill completed",
      updated: updatedCount,
      skipped: skippedCount,
      total: lineupsWithoutTime.length,
      errors: errors.slice(0, 10), // Limit errors to first 10
    });
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json(
      {
        error: "Failed to backfill seedTimes",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
