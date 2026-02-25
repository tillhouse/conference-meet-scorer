import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMeetOwnerId } from "@/lib/meet-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { meetId } = await params;

    const meet = await prisma.meet.findUnique({
      where: { id: meetId },
      include: {
        team: { select: { ownerId: true } },
        teamAccount: { select: { ownerId: true } },
      },
    });

    if (!meet) {
      return NextResponse.json({ error: "Meet not found" }, { status: 404 });
    }

    const ownerId = getMeetOwnerId(meet);
    if (session.user.id !== ownerId) {
      return NextResponse.json(
        { error: "Only the meet owner can delete this meet" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const confirmation = typeof body.confirmation === "string" ? body.confirmation : "";
    if (confirmation !== "DELETE") {
      return NextResponse.json(
        { error: 'Confirmation required. Send { "confirmation": "DELETE" } to confirm.' },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.chatSession.updateMany({
        where: { meetId },
        data: { meetId: null },
      });
      await tx.meet.delete({
        where: { id: meetId },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting meet:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete meet",
      },
      { status: 500 }
    );
  }
}
