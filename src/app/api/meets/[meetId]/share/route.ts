import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMeetOwnerId } from "@/lib/meet-auth";
import { randomBytes } from "crypto";

function getOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

export async function GET(
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
        { error: "Only the meet owner can view share settings" },
        { status: 403 }
      );
    }

    const shareToken = meet.shareToken ?? null;
    const origin = getOrigin(request);
    const url = shareToken ? `${origin}/view/meet/${shareToken}` : null;

    return NextResponse.json({ shareToken, url });
  } catch (error) {
    console.error("Error fetching share status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch share status" },
      { status: 500 }
    );
  }
}

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
        { error: "Only the meet owner can create a share link" },
        { status: 403 }
      );
    }

    let shareToken = meet.shareToken;
    if (!shareToken) {
      shareToken = randomBytes(24).toString("base64url");
      await prisma.meet.update({
        where: { id: meetId },
        data: { shareToken },
      });
    }

    const origin = getOrigin(request);
    const url = `${origin}/view/meet/${shareToken}`;

    return NextResponse.json({ shareToken, url });
  } catch (error) {
    console.error("Error creating share link:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create share link" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
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
        { error: "Only the meet owner can revoke the share link" },
        { status: 403 }
      );
    }

    await prisma.meet.update({
      where: { id: meetId },
      data: { shareToken: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking share link:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to revoke share link" },
      { status: 500 }
    );
  }
}
