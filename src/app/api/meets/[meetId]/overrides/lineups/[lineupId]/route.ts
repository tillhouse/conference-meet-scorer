import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTimeToSeconds } from "@/lib/utils";
import { z } from "zod";

const overrideTimeSchema = z.object({
  time: z.string().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string; lineupId: string }> }
) {
  try {
    const { meetId, lineupId } = await params;
    const body = await request.json();
    const data = overrideTimeSchema.parse(body);

    // Find the lineup
    const lineup = await prisma.meetLineup.findUnique({
      where: { id: lineupId },
      include: {
        event: true,
      },
    });

    if (!lineup) {
      return NextResponse.json({ error: "Lineup not found" }, { status: 404 });
    }

    if (lineup.meetId !== meetId) {
      return NextResponse.json({ error: "Lineup does not belong to this meet" }, { status: 400 });
    }

    // Parse time to seconds if provided
    let overrideTimeSeconds: number | null = null;
    if (data.time) {
      overrideTimeSeconds = parseTimeToSeconds(data.time);
    }

    // Update the lineup with override
    const updated = await prisma.meetLineup.update({
      where: { id: lineupId },
      data: {
        overrideTime: data.time,
        overrideTimeSeconds: overrideTimeSeconds,
      },
    });

    return NextResponse.json({
      success: true,
      lineup: updated,
    });
  } catch (error: any) {
    console.error("Error updating time override:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to update time override" },
      { status: 500 }
    );
  }
}
