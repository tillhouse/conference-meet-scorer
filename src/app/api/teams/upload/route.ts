import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCSV } from "@/lib/csv-parser";
import { normalizeEventName, findEventByName } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const teamId = formData.get("teamId") as string;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!teamId) {
      return NextResponse.json(
        { error: "Team ID is required" },
        { status: 400 }
      );
    }

    // Verify team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    // Read file content
    const content = await file.text();
    const parsedAthletes = parseCSV(content);

    if (parsedAthletes.length === 0) {
      return NextResponse.json(
        { error: "No valid athlete data found in file" },
        { status: 400 }
      );
    }

    let athletesAdded = 0;
    let eventsAdded = 0;
    const errors: string[] = [];

    // Process each athlete
    for (const parsedAthlete of parsedAthletes) {
      try {
        // Find or create athlete (SQLite doesn't support case-insensitive, so we'll do exact match)
        let athlete = await prisma.athlete.findFirst({
          where: {
            teamId,
            firstName: parsedAthlete.firstName,
            lastName: parsedAthlete.lastName,
          },
        });

        if (!athlete) {
          athlete = await prisma.athlete.create({
            data: {
              firstName: parsedAthlete.firstName,
              lastName: parsedAthlete.lastName,
              year: parsedAthlete.year,
              isDiver: parsedAthlete.isDiver,
              teamId,
            },
          });
          athletesAdded++;
        } else {
          // Update athlete if needed
          await prisma.athlete.update({
            where: { id: athlete.id },
            data: {
              year: parsedAthlete.year || athlete.year,
              isDiver: parsedAthlete.isDiver || athlete.isDiver,
            },
          });
        }

        // Process events
        for (const eventData of parsedAthlete.events) {
          try {
            // Normalize event name to standard format
            const normalizedEventName = normalizeEventName(eventData.eventName);
            
            // Find or create event - try normalized name first, then original
            let event = await prisma.event.findUnique({
              where: { name: normalizedEventName },
            });
            
            // If not found with normalized name, try original name
            if (!event) {
              event = await prisma.event.findUnique({
                where: { name: eventData.eventName },
              });
            }
            
            // If still not found, try to find by normalized match in all events
            if (!event) {
              const allEvents = await prisma.event.findMany({
                where: { eventType: { in: ["individual", "diving"] } },
              });
              const foundEvent = findEventByName(allEvents, eventData.eventName);
              if (foundEvent) {
                event = await prisma.event.findUnique({
                  where: { id: foundEvent.id },
                });
              }
            }

            if (!event) {
              // Determine event type
              const isDivingEvent =
                normalizedEventName.includes("1M") ||
                normalizedEventName.includes("3M") ||
                normalizedEventName.toLowerCase().includes("platform") ||
                normalizedEventName.toLowerCase().includes("diving");
              const eventType = isDivingEvent ? "diving" : "individual";

              // Create event with normalized name
              event = await prisma.event.create({
                data: {
                  name: normalizedEventName,
                  fullName: normalizedEventName, // Can be enhanced later
                  eventType,
                  sortOrder: 0, // Can be enhanced later
                },
              });
            }

            // Find or create athlete event (individual event, not relay split)
            const existingAthleteEvent =
              await prisma.athleteEvent.findUnique({
                where: {
                  athleteId_eventId_isRelaySplit: {
                    athleteId: athlete.id,
                    eventId: event.id,
                    isRelaySplit: false,
                  },
                },
              });

            if (existingAthleteEvent) {
              // Update existing time if new time is faster (for swimming) or higher (for diving)
              const shouldUpdate =
                event.eventType === "diving"
                  ? eventData.timeSeconds > existingAthleteEvent.timeSeconds
                  : eventData.timeSeconds < existingAthleteEvent.timeSeconds;

              if (shouldUpdate) {
                await prisma.athleteEvent.update({
                  where: { id: existingAthleteEvent.id },
                  data: {
                    time: eventData.time,
                    timeSeconds: eventData.timeSeconds,
                    source: "csv_upload",
                  },
                });
                eventsAdded++;
              }
            } else {
              await prisma.athleteEvent.create({
                data: {
                  athleteId: athlete.id,
                  eventId: event.id,
                  time: eventData.time,
                  timeSeconds: eventData.timeSeconds,
                  isRelaySplit: false, // CSV uploads are individual events, not relay splits
                  source: "csv_upload",
                },
              });
              eventsAdded++;
            }
          } catch (eventError) {
            const errorMsg = eventError instanceof Error ? eventError.message : String(eventError);
            console.error(`Event error for ${parsedAthlete.firstName} ${parsedAthlete.lastName} - ${eventData.eventName}:`, errorMsg);
            errors.push(
              `Failed to process event ${eventData.eventName} for ${parsedAthlete.firstName} ${parsedAthlete.lastName}: ${errorMsg}`
            );
          }
        }
      } catch (athleteError) {
        const errorMsg = athleteError instanceof Error ? athleteError.message : String(athleteError);
        console.error(`Athlete error for ${parsedAthlete.firstName} ${parsedAthlete.lastName}:`, errorMsg);
        errors.push(
          `Failed to process athlete ${parsedAthlete.firstName} ${parsedAthlete.lastName}: ${errorMsg}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      athletesAdded,
      eventsAdded,
      errors: errors.slice(0, 20), // Show more errors for debugging
    });
  } catch (error) {
    console.error("CSV upload error:", error);
    return NextResponse.json(
      {
        error: "Failed to process file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
