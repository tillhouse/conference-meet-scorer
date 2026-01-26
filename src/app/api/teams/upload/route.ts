import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCSV } from "@/lib/csv-parser";

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
        // Find or create athlete
        let athlete = await prisma.athlete.findFirst({
          where: {
            teamId,
            firstName: {
              equals: parsedAthlete.firstName,
              mode: "insensitive",
            },
            lastName: {
              equals: parsedAthlete.lastName,
              mode: "insensitive",
            },
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
            // Find or create event
            let event = await prisma.event.findUnique({
              where: { name: eventData.eventName },
            });

            if (!event) {
              // Determine event type
              const isDivingEvent =
                eventData.eventName.includes("1M") ||
                eventData.eventName.includes("3M");
              const eventType = isDivingEvent ? "diving" : "individual";

              event = await prisma.event.create({
                data: {
                  name: eventData.eventName,
                  fullName: eventData.eventName, // Can be enhanced later
                  eventType,
                  sortOrder: 0, // Can be enhanced later
                },
              });
            }

            // Find or create athlete event
            const existingAthleteEvent =
              await prisma.athleteEvent.findUnique({
                where: {
                  athleteId_eventId: {
                    athleteId: athlete.id,
                    eventId: event.id,
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
                  source: "csv_upload",
                },
              });
              eventsAdded++;
            }
          } catch (eventError) {
            errors.push(
              `Failed to process event ${eventData.eventName} for ${parsedAthlete.firstName} ${parsedAthlete.lastName}`
            );
          }
        }
      } catch (athleteError) {
        errors.push(
          `Failed to process athlete ${parsedAthlete.firstName} ${parsedAthlete.lastName}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      athletesAdded,
      eventsAdded,
      errors: errors.slice(0, 10), // Limit errors to first 10
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
