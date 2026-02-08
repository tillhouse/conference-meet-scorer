import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Get all meets for a team account
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
      return NextResponse.json({ error: "Team account not found" }, { status: 404 });
    }

    const isOwner = team.ownerId === session.user.id;
    const isMember = team.members.length > 0;

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get all meets linked to this team account
    const meets = await prisma.meet.findMany({
      where: {
        teamAccountId: id,
      },
      include: {
        meetTeams: {
          include: {
            team: true,
          },
        },
        _count: {
          select: {
            meetTeams: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(meets);
  } catch (error) {
    console.error("Error fetching team meets:", error);
    return NextResponse.json(
      { error: "Failed to fetch meets" },
      { status: 500 }
    );
  }
}
