import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({
  variant: z.enum(["baseline", "better", "worse"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string; teamId: string }> }
) {
  try {
    const { meetId, teamId } = await params;
    const body = await request.json();
    const data = bodySchema.parse(body);

    const meetTeam = await prisma.meetTeam.findUnique({
      where: {
        meetId_teamId: { meetId, teamId },
      },
    });

    if (!meetTeam) {
      return NextResponse.json(
        { error: "Team not found in meet" },
        { status: 404 }
      );
    }

    const mt = meetTeam as { sensitivityAthleteId?: string | null };
    if (!mt.sensitivityAthleteId) {
      return NextResponse.json(
        { error: "This team has no sensitivity analysis; cannot set variant" },
        { status: 400 }
      );
    }

    await prisma.meetTeam.update({
      where: {
        meetId_teamId: { meetId, teamId },
      },
      data: {
        sensitivityVariant: data.variant,
      } as Record<string, unknown>,
    });

    return NextResponse.json({ success: true, variant: data.variant });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid variant", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating sensitivity variant:", error);
    return NextResponse.json(
      { error: "Failed to update sensitivity variant" },
      { status: 500 }
    );
  }
}
