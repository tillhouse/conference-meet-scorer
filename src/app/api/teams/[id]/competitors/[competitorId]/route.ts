import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE: Remove a competitor team from the master database
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; competitorId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, competitorId } = await params;

    // Verify user has permission (owner or admin)
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          where: {
            userId: session.user.id,
            role: { in: ["owner", "admin", "coach"] },
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team account not found" }, { status: 404 });
    }

    const isOwner = team.ownerId === session.user.id;
    const canEdit = isOwner || team.members.length > 0;

    if (!canEdit) {
      return NextResponse.json(
        { error: "You don't have permission to remove competitor teams" },
        { status: 403 }
      );
    }

    // Check if teamCompetitor model exists
    if (!prisma.teamCompetitor) {
      console.error("Prisma client missing teamCompetitor model. Run: npx prisma generate");
      return NextResponse.json(
        { 
          error: "Database model not available",
          details: "The Prisma client needs to be regenerated. Please stop the dev server, run 'npx prisma generate', and restart the server."
        },
        { status: 500 }
      );
    }

    // Verify competitor relationship exists
    const competitor = await prisma.teamCompetitor.findUnique({
      where: {
        teamAccountId_competitorTeamId: {
          teamAccountId: id,
          competitorTeamId: competitorId,
        },
      },
    });

    if (!competitor) {
      return NextResponse.json(
        { error: "Competitor team not found in master database" },
        { status: 404 }
      );
    }

    // Remove competitor team
    await prisma.teamCompetitor.delete({
      where: {
        teamAccountId_competitorTeamId: {
          teamAccountId: id,
          competitorTeamId: competitorId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing competitor team:", error);
    return NextResponse.json(
      { error: "Failed to remove competitor team" },
      { status: 500 }
    );
  }
}
