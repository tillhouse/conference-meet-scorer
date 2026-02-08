import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addCompetitorSchema = z.object({
  competitorTeamId: z.string(),
});

// GET: Get all competitor teams for a team account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify user has access to this team account
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          where: { userId: session.user.id },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const isOwner = team.ownerId === session.user.id;
    const isMember = team.members.length > 0;

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get all competitor teams
    // Check if teamCompetitor model exists (in case Prisma client wasn't regenerated)
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

    const competitors = await prisma.teamCompetitor.findMany({
      where: { teamAccountId: id },
      include: {
        competitorTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            schoolName: true,
            primaryColor: true,
            _count: {
              select: {
                athletes: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(competitors);
  } catch (error) {
    console.error("Error fetching competitor teams:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorDetails = error instanceof Error ? error.stack : String(error);
    console.error("Error details:", errorDetails);
    return NextResponse.json(
      { 
        error: "Failed to fetch competitor teams",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// POST: Add a competitor team to the master database
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const data = addCompetitorSchema.parse(body);

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
        { error: "You don't have permission to add competitor teams" },
        { status: 403 }
      );
    }

    // Verify competitor team exists
    const competitorTeam = await prisma.team.findUnique({
      where: { id: data.competitorTeamId },
    });

    if (!competitorTeam) {
      return NextResponse.json(
        { error: "Competitor team not found" },
        { status: 404 }
      );
    }

    // Don't allow adding the same team as a competitor
    if (data.competitorTeamId === id) {
      return NextResponse.json(
        { error: "Cannot add your own team as a competitor" },
        { status: 400 }
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

    // Check if already added
    const existing = await prisma.teamCompetitor.findUnique({
      where: {
        teamAccountId_competitorTeamId: {
          teamAccountId: id,
          competitorTeamId: data.competitorTeamId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This team is already in your master database" },
        { status: 400 }
      );
    }

    // Add competitor team
    const competitor = await prisma.teamCompetitor.create({
      data: {
        teamAccountId: id,
        competitorTeamId: data.competitorTeamId,
        addedBy: session.user.id,
      },
      include: {
        competitorTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            schoolName: true,
            primaryColor: true,
            _count: {
              select: {
                athletes: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(competitor, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error adding competitor team:", error);
    return NextResponse.json(
      { error: "Failed to add competitor team" },
      { status: 500 }
    );
  }
}
