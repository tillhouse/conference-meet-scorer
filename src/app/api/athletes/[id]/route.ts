import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateAthleteSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  year: z.string().optional(),
  isDiver: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const athlete = await prisma.athlete.findUnique({
      where: { id },
      include: {
        eventTimes: {
          include: {
            event: true,
          },
        },
      },
    });

    if (!athlete) {
      return NextResponse.json(
        { error: "Athlete not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(athlete);
  } catch (error) {
    console.error("Error fetching athlete:", error);
    return NextResponse.json(
      { error: "Failed to fetch athlete" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateAthleteSchema.parse(body);

    // Verify athlete exists
    const existingAthlete = await prisma.athlete.findUnique({
      where: { id },
    });

    if (!existingAthlete) {
      return NextResponse.json(
        { error: "Athlete not found" },
        { status: 404 }
      );
    }

    const athlete = await prisma.athlete.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.year !== undefined && { year: data.year }),
        ...(data.isDiver !== undefined && { isDiver: data.isDiver }),
      },
    });

    return NextResponse.json(athlete);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating athlete:", error);
    return NextResponse.json(
      { error: "Failed to update athlete" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify athlete exists
    const athlete = await prisma.athlete.findUnique({
      where: { id },
    });

    if (!athlete) {
      return NextResponse.json(
        { error: "Athlete not found" },
        { status: 404 }
      );
    }

    // Delete athlete (cascade will delete event times)
    await prisma.athlete.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting athlete:", error);
    return NextResponse.json(
      { error: "Failed to delete athlete" },
      { status: 500 }
    );
  }
}
