import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateEventOrderSchema = z.object({
  eventOrder: z.array(z.string()),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string }> }
) {
  try {
    const { meetId } = await params;
    const body = await request.json();
    const { eventOrder } = updateEventOrderSchema.parse(body);

    // Verify the meet exists
    const meet = await prisma.meet.findUnique({
      where: { id: meetId },
      select: { id: true, selectedEvents: true },
    });

    if (!meet) {
      return NextResponse.json({ error: "Meet not found" }, { status: 404 });
    }

    // Verify all event IDs in the order are valid selected events
    const selectedEvents = meet.selectedEvents
      ? (JSON.parse(meet.selectedEvents) as string[])
      : [];

    const invalidEvents = eventOrder.filter((id) => !selectedEvents.includes(id));
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: `Invalid event IDs: ${invalidEvents.join(", ")}` },
        { status: 400 }
      );
    }

    // Update the meet with the new event order
    await prisma.meet.update({
      where: { id: meetId },
      data: {
        eventOrder: JSON.stringify(eventOrder),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating event order:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to update event order" },
      { status: 500 }
    );
  }
}
