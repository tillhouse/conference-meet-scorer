import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string }> }
) {
  try {
    const { meetId } = await params;

    const meet = await prisma.meet.findUnique({
      where: { id: meetId },
      include: {
        meetLineups: {
          include: {
            athlete: {
              include: {
                team: true,
              },
            },
            event: true,
          },
        },
        relayEntries: {
          include: {
            team: true,
            event: true,
          },
        },
        meetTeams: {
          include: {
            team: true,
          },
        },
      },
    });

    if (!meet) {
      return NextResponse.json({ error: "Meet not found" }, { status: 404 });
    }

    return NextResponse.json({
      meetId,
      meetName: meet.name,
      meetLineupsCount: meet.meetLineups.length,
      relayEntriesCount: meet.relayEntries.length,
      meetTeamsCount: meet.meetTeams.length,
      meetLineups: meet.meetLineups.map((l) => ({
        id: l.id,
        athleteId: l.athleteId,
        athleteName: `${l.athlete.firstName} ${l.athlete.lastName}`,
        teamName: l.athlete.team.name,
        eventId: l.eventId,
        eventName: l.event.name,
        seedTime: l.seedTime,
      })),
      relayEntries: meet.relayEntries.map((r) => ({
        id: r.id,
        teamId: r.teamId,
        teamName: r.team.name,
        eventId: r.eventId,
        eventName: r.event?.name || "Unknown",
        seedTime: r.seedTime,
      })),
      meetTeams: meet.meetTeams.map((mt) => ({
        id: mt.id,
        teamId: mt.teamId,
        teamName: mt.team.name,
        selectedAthletes: mt.selectedAthletes
          ? JSON.parse(mt.selectedAthletes)
          : [],
      })),
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json(
      { error: "Failed to fetch debug info", details: String(error) },
      { status: 500 }
    );
  }
}
