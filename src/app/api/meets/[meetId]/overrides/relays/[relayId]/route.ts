import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTimeToSeconds } from "@/lib/utils";
import { z } from "zod";

const overrideTimeSchema = z.object({
  time: z.string().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string; relayId: string }> }
) {
  try {
    const { meetId, relayId } = await params;
    const body = await request.json();
    const data = overrideTimeSchema.parse(body);

    // Find the relay
    const relay = await prisma.relayEntry.findUnique({
      where: { id: relayId },
    });

    if (!relay) {
      return NextResponse.json({ error: "Relay not found" }, { status: 404 });
    }

    if (relay.meetId !== meetId) {
      return NextResponse.json({ error: "Relay does not belong to this meet" }, { status: 400 });
    }

    // Parse time to seconds if provided
    let overrideTimeSeconds: number | null = null;
    if (data.time) {
      overrideTimeSeconds = parseTimeToSeconds(data.time);
    }

    // Update the relay with override
    const updated = await prisma.relayEntry.update({
      where: { id: relayId },
      data: {
        overrideTime: data.time,
        overrideTimeSeconds: overrideTimeSeconds,
      },
    });

    return NextResponse.json({
      success: true,
      relay: updated,
    });
  } catch (error: any) {
    console.error("Error updating relay time override:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to update time override" },
      { status: 500 }
    );
  }
}
