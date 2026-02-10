import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: List all chat sessions for the current user
// Note: Currently sessions aren't user-specific in the schema
// This could be enhanced later to add userId to ChatSession
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const meetId = searchParams.get("meetId");
    const teamId = searchParams.get("teamId");

    const where: any = {};
    if (meetId) where.meetId = meetId;
    if (teamId) where.teamId = teamId;

    const sessions = await prisma.chatSession.findMany({
      where,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1, // Just get the last message for preview
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50, // Limit to 50 most recent sessions
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Get chat sessions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat sessions" },
      { status: 500 }
    );
  }
}
