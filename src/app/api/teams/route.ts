import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createTeamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  shortName: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  conferenceId: z.string().optional(),
});

export async function GET() {
  try {
    const teams = await prisma.team.findMany({
      include: {
        _count: {
          select: {
            athletes: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(teams);
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createTeamSchema.parse(body);

    const team = await prisma.team.create({
      data: {
        name: data.name,
        shortName: data.shortName,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        conferenceId: data.conferenceId,
      },
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating team:", error);
    return NextResponse.json(
      { error: "Failed to create team" },
      { status: 500 }
    );
  }
}
