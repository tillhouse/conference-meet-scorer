import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCSV } from "@/lib/csv-parser";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const meetId = formData.get("meetId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!meetId) {
      return NextResponse.json({ error: "Meet ID is required" }, { status: 400 });
    }

    // Verify meet exists and get teams
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

    if (meet.meetTeams.length === 0) {
      return NextResponse.json(
        { error: "No teams added to this meet yet. Please add teams first." },
        { status: 400 }
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

    // Create a map of team names to team IDs for matching
    const teamNameMap = new Map<string, string>();
    meet.meetTeams.forEach((mt) => {
      // Map by team name (case-insensitive)
      teamNameMap.set(mt.team.name.toLowerCase().trim(), mt.team.id);
      // Also map by short name if available
      if (mt.team.shortName) {
        teamNameMap.set(mt.team.shortName.toLowerCase().trim(), mt.team.id);
      }
      // Map by school name + team name if school name exists
      if (mt.team.schoolName) {
        const schoolTeamKey = `${mt.team.schoolName.toLowerCase().trim()} ${mt.team.name.toLowerCase().trim()}`;
        teamNameMap.set(schoolTeamKey, mt.team.id);
      }
    });

    let athletesAdded = 0;
    let eventsAdded = 0;
    const teamsProcessed = new Set<string>();
    const errors: string[] = [];
    const unmatchedTeams = new Set<string>();

    // Process each athlete
    for (const parsedAthlete of parsedAthletes) {
      try {
        // Determine which team this athlete belongs to
        let targetTeamId: string | null = null;

        // Option 1: CSV has team column - try to match
        if (parsedAthlete.teamName) {
          const teamNameLower = parsedAthlete.teamName.toLowerCase().trim();
          // Try exact match first
          if (teamNameMap.has(teamNameLower)) {
            targetTeamId = teamNameMap.get(teamNameLower)!;
          } else {
            // Try partial matching (e.g., "Men's Swimming" matches "Men's Swimming")
            for (const [key, teamId] of teamNameMap.entries()) {
              if (key.includes(teamNameLower) || teamNameLower.includes(key)) {
                targetTeamId = teamId;
                break;
              }
            }
          }

          if (!targetTeamId) {
            unmatchedTeams.add(parsedAthlete.teamName);
            errors.push(
              `Team "${parsedAthlete.teamName}" not found in meet. Athlete: ${parsedAthlete.firstName} ${parsedAthlete.lastName}`
            );
            continue; // Skip this athlete
          }
        } else {
          // Option 2: No team column - use first team as fallback (for single-team uploads)
          // This is a limitation - user should either include team column or upload per team
          targetTeamId = meet.meetTeams[0].team.id;
          if (meet.meetTeams.length > 1) {
            errors.push(
              `No team specified for ${parsedAthlete.firstName} ${parsedAthlete.lastName}. Assigned to ${meet.meetTeams[0].team.name}. Consider adding a "Team" column to your CSV.`
            );
          }
        }

        // Find or create athlete in the correct team's database
        // This ensures times persist across meets
        let athlete = await prisma.athlete.findFirst({
          where: {
            teamId: targetTeamId,
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
              teamId: targetTeamId, // Save to team database (persists across meets)
            },
          });
          athletesAdded++;
          teamsProcessed.add(targetTeamId);
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
                eventData.eventName.includes("3M") ||
                eventData.eventName.toLowerCase().includes("platform");
              const eventType = isDivingEvent ? "diving" : "individual";

              event = await prisma.event.create({
                data: {
                  name: eventData.eventName,
                  fullName: eventData.eventName,
                  eventType,
                  sortOrder: 0,
                },
              });
            }

            // Find or create athlete event
            const existingAthleteEvent = await prisma.athleteEvent.findUnique({
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
                  isRelaySplit: false,
                  source: "csv_upload",
                },
              });
              eventsAdded++;
            }
          } catch (eventError) {
            const errorMsg =
              eventError instanceof Error ? eventError.message : String(eventError);
            console.error(
              `Event error for ${parsedAthlete.firstName} ${parsedAthlete.lastName} - ${eventData.eventName}:`,
              errorMsg
            );
            errors.push(
              `Failed to process event ${eventData.eventName} for ${parsedAthlete.firstName} ${parsedAthlete.lastName}: ${errorMsg}`
            );
          }
        }
      } catch (athleteError) {
        const errorMsg =
          athleteError instanceof Error ? athleteError.message : String(athleteError);
        console.error(
          `Athlete error for ${parsedAthlete.firstName} ${parsedAthlete.lastName}:`,
          errorMsg
        );
        errors.push(
          `Failed to process athlete ${parsedAthlete.firstName} ${parsedAthlete.lastName}: ${errorMsg}`
        );
      }
    }

    // Add warning about unmatched teams
    if (unmatchedTeams.size > 0) {
      errors.unshift(
        `Warning: ${unmatchedTeams.size} team(s) in CSV not found in meet: ${Array.from(unmatchedTeams).join(", ")}`
      );
    }

    return NextResponse.json({
      success: true,
      athletesAdded,
      eventsAdded,
      teamsProcessed: teamsProcessed.size,
      errors: errors.slice(0, 20),
      message: `Data saved to team databases. These times will be available for all meets using these teams.`,
    });
  } catch (error) {
    console.error("Meet CSV upload error:", error);
    return NextResponse.json(
      {
        error: "Failed to process file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
