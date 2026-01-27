import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const saveRosterSchema = z.object({
  athleteIds: z.array(z.string()),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string; teamId: string }> }
) {
  try {
    const { meetId, teamId } = await params;

    // Get athletes that are already in the meet lineup for this team
    const lineups = await prisma.meetLineup.findMany({
      where: {
        meetId,
        athlete: {
          teamId,
        },
      },
      select: {
        athleteId: true,
      },
      distinct: ["athleteId"],
    });

    return NextResponse.json({
      athleteIds: lineups.map((l) => l.athleteId),
    });
  } catch (error) {
    console.error("Error fetching roster:", error);
    return NextResponse.json(
      { error: "Failed to fetch roster" },
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
    const data = saveRosterSchema.parse(body);

    // Verify meet and team exist
    const meet = await prisma.meet.findUnique({
      where: { id: meetId },
    });

    if (!meet) {
      return NextResponse.json(
        { error: "Meet not found" },
        { status: 404 }
      );
    }

    const meetTeam = await prisma.meetTeam.findUnique({
      where: {
        meetId_teamId: {
          meetId,
          teamId,
        },
      },
    });

    if (!meetTeam) {
      return NextResponse.json(
        { error: "Team not found in meet" },
        { status: 404 }
      );
    }

    // Get athletes to verify they belong to the team
    const athletes = await prisma.athlete.findMany({
      where: {
        id: { in: data.athleteIds },
        teamId,
      },
    });

    if (athletes.length !== data.athleteIds.length) {
      return NextResponse.json(
        { error: "Some athletes not found or don't belong to this team" },
        { status: 400 }
      );
    }

    // Validate roster constraints
    const swimmers = athletes.filter((a) => !a.isDiver).length;
    const divers = athletes.filter((a) => a.isDiver).length;
    const rosterCount = swimmers + divers * meet.diverRatio;

    if (rosterCount > meet.maxAthletes) {
      return NextResponse.json(
        {
          error: `Roster exceeds limit: ${rosterCount.toFixed(2)} > ${meet.maxAthletes}`,
        },
        { status: 400 }
      );
    }

    // For now, we'll just store this in the meetLineup table when events are selected
    // The roster selection is more of a UI state - we'll persist it when lineups are set
    // This endpoint is mainly for validation and future roster storage

    return NextResponse.json({
      success: true,
      message: "Roster validated successfully",
      rosterCount: rosterCount.toFixed(2),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error saving roster:", error);
    return NextResponse.json(
      { error: "Failed to save roster" },
      { status: 500 }
    );
  }
}
