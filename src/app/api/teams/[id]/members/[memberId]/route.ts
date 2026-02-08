import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateMemberSchema = z.object({
  role: z.enum(["admin", "coach", "assistant", "viewer"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, memberId } = await params;
    const body = await request.json();
    const data = updateMemberSchema.parse(body);

    // Check if user is owner or admin
    const team = await prisma.team.findFirst({
      where: {
        id,
        OR: [
          { ownerId: session.user.id },
          {
            members: {
              some: {
                userId: session.user.id,
                role: { in: ["owner", "admin"] },
              },
            },
          },
        ],
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team not found or insufficient permissions" },
        { status: 404 }
      );
    }

    // Get the member being updated
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.teamId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Don't allow changing owner role (owner is set via team.ownerId)
    if (member.role === "owner") {
      return NextResponse.json(
        { error: "Cannot change owner role" },
        { status: 400 }
      );
    }

    // Update member role
    const updated = await prisma.teamMember.update({
      where: { id: memberId },
      data: {
        role: data.role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating team member:", error);
    return NextResponse.json(
      { error: "Failed to update team member" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, memberId } = await params;

    // Check if user is owner or admin
    const team = await prisma.team.findFirst({
      where: {
        id,
        OR: [
          { ownerId: session.user.id },
          {
            members: {
              some: {
                userId: session.user.id,
                role: { in: ["owner", "admin"] },
              },
            },
          },
        ],
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team not found or insufficient permissions" },
        { status: 404 }
      );
    }

    // Get the member being removed
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.teamId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Don't allow removing owner
    if (member.role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove owner. Transfer ownership first." },
        { status: 400 }
      );
    }

    // Remove member
    await prisma.teamMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ message: "Member removed successfully" });
  } catch (error) {
    console.error("Error removing team member:", error);
    return NextResponse.json(
      { error: "Failed to remove team member" },
      { status: 500 }
    );
  }
}
