import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createAthleteSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  year: z.string().optional(),
  isDiver: z.boolean().default(false),
  teamId: z.string().min(1, "Team ID is required"),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return NextResponse.json(
        { error: "Team ID is required" },
        { status: 400 }
      );
    }

    const athletes = await prisma.athlete.findMany({
      where: {
        teamId,
      },
      include: {
        eventTimes: {
          include: {
            event: true,
          },
        },
      },
      orderBy: [
        { lastName: "asc" },
        { firstName: "asc" },
      ],
    });

    return NextResponse.json(athletes);
  } catch (error) {
    console.error("Error fetching athletes:", error);
    return NextResponse.json(
      { error: "Failed to fetch athletes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createAthleteSchema.parse(body);

    // Verify team exists
    const team = await prisma.team.findUnique({
      where: { id: data.teamId },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    const athlete = await prisma.athlete.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        year: data.year,
        isDiver: data.isDiver,
        teamId: data.teamId,
      },
    });

    return NextResponse.json(athlete, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error creating athlete:", error);
    return NextResponse.json(
      { error: "Failed to create athlete" },
      { status: 500 }
    );
  }
}
