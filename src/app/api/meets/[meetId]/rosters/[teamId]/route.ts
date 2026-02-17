import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const DEBUG_LOG = (payload: Record<string, unknown>) => {
  fetch("http://127.0.0.1:7242/ingest/426f4955-f215-4c12-ba39-c5cdc5ffe243", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, timestamp: Date.now() }),
  }).catch(() => {});
};

const saveRosterSchema = z.object({
  athleteIds: z.array(z.string()),
  testSpotAthleteIds: z.array(z.string()).optional(),
  testSpotScoringAthleteId: z.string().optional(),
  sensitivityAthleteId: z.string().nullish(),
  sensitivityPercent: z.number().min(0.5).max(10).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string; teamId: string }> }
) {
  try {
    const { meetId, teamId } = await params;

    // Get the saved roster from MeetTeam
    const meetTeam = await prisma.meetTeam.findUnique({
      where: {
        meetId_teamId: {
          meetId,
          teamId,
        },
      },
    });

    if (!meetTeam) {
      return NextResponse.json({
        athleteIds: [],
      });
    }

    const athleteIds = meetTeam.selectedAthletes
      ? (JSON.parse(meetTeam.selectedAthletes) as string[])
      : [];
    const testSpotAthleteIds = meetTeam.testSpotAthleteIds
      ? (JSON.parse(meetTeam.testSpotAthleteIds) as string[])
      : [];
    const testSpotScoringAthleteId = meetTeam.testSpotScoringAthleteId ?? null;
    const mt = meetTeam as { sensitivityAthleteId?: string | null; sensitivityPercent?: number | null; sensitivityVariant?: string | null };
    const sensitivityAthleteId = mt.sensitivityAthleteId ?? null;
    const sensitivityPercent = mt.sensitivityPercent ?? null;
    const sensitivityVariant = mt.sensitivityVariant ?? null;

    return NextResponse.json({
      athleteIds,
      testSpotAthleteIds,
      testSpotScoringAthleteId,
      sensitivityAthleteId,
      sensitivityPercent,
      sensitivityVariant,
    });
  } catch (error) {
    console.error("Error fetching roster:", error);
    return NextResponse.json(
      { error: "Failed to fetch roster" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string; teamId: string }> }
) {
  try {
    const { meetId, teamId } = await params;
    const body = await request.json();
    // #region agent log
    DEBUG_LOG({ location: "rosters/[teamId]/route.ts:POST-body", message: "Roster POST body before parse", data: { bodyKeys: Object.keys(body), sensitivityAthleteId: body.sensitivityAthleteId, sensitivityPercent: body.sensitivityPercent }, timestamp: Date.now(), hypothesisId: "H1" });
    // #endregion
    let data: z.infer<typeof saveRosterSchema>;
    try {
      data = saveRosterSchema.parse(body);
    } catch (parseError) {
      // #region agent log
      if (parseError instanceof z.ZodError) {
        DEBUG_LOG({ location: "rosters/[teamId]/route.ts:POST-zod", message: "Zod parse failed", data: { issues: parseError.issues, firstMessage: parseError.issues[0]?.message }, timestamp: Date.now(), hypothesisId: "H1" });
      }
      // #endregion
      throw parseError;
    }

    // Verify meet and team exist
    const meet = await prisma.meet.findUnique({
      where: { id: meetId },
    });

    if (!meet) {
      return NextResponse.json(
        { error: "Meet not found" },
        { status: 404 }
      );
    }

    const meetTeam = await prisma.meetTeam.findUnique({
      where: {
        meetId_teamId: {
          meetId,
          teamId,
        },
      },
    });

    if (!meetTeam) {
      return NextResponse.json(
        { error: "Team not found in meet" },
        { status: 404 }
      );
    }

    // Get athletes to verify they belong to the team
    const athletes = await prisma.athlete.findMany({
      where: {
        id: { in: data.athleteIds },
        teamId,
      },
    });

    if (athletes.length !== data.athleteIds.length) {
      return NextResponse.json(
        { error: "Some athletes not found or don't belong to this team" },
        { status: 400 }
      );
    }

    // Test spot: optional bubble candidates for one slot; only one's points count
    const testSpotAthleteIds = data.testSpotAthleteIds ?? [];
    const testSpotScoringAthleteId = data.testSpotScoringAthleteId ?? null;

    const athleteIdSet = new Set(data.athleteIds);
    const testSpotSet = new Set(testSpotAthleteIds);

    // Test spot must be a subset of selected athletes; scorer must be in test spot when test spot is used
    if (testSpotAthleteIds.length > 0) {
      if (testSpotAthleteIds.some((id) => !athleteIdSet.has(id))) {
        return NextResponse.json(
          { error: "testSpotAthleteIds must be a subset of athleteIds" },
          { status: 400 }
        );
      }
      if (!testSpotScoringAthleteId || !testSpotSet.has(testSpotScoringAthleteId)) {
        return NextResponse.json(
          { error: "testSpotScoringAthleteId must be one of testSpotAthleteIds when test spot is used" },
          { status: 400 }
        );
      }
    }

    // Sensitivity: athlete must be on roster; clear if not
    const sensitivityAthleteId = data.sensitivityAthleteId ?? null;
    const sensitivityPercent = data.sensitivityPercent ?? null;
    if (sensitivityAthleteId !== null) {
      if (!athleteIdSet.has(sensitivityAthleteId)) {
        return NextResponse.json(
          { error: "sensitivityAthleteId must be one of athleteIds" },
          { status: 400 }
        );
      }
    }

    // Scoring roster = everyone except test-spot candidates, plus the one scoring test-spot athlete
    const scoringAthleteIds = data.athleteIds.filter((id) => !testSpotSet.has(id) || id === testSpotScoringAthleteId);
    const scoringAthletes = athletes.filter((a) => scoringAthleteIds.includes(a.id));
    const scoringSwimmers = scoringAthletes.filter((a) => !a.isDiver).length;
    const scoringDivers = scoringAthletes.filter((a) => a.isDiver).length;
    const scoringRosterCount = scoringSwimmers + scoringDivers * meet.diverRatio;

    if (scoringRosterCount > meet.maxAthletes) {
      return NextResponse.json(
        {
          error: `Scoring roster exceeds limit: ${scoringRosterCount.toFixed(2)} > ${meet.maxAthletes}`,
        },
        { status: 400 }
      );
    }

    // Save the roster selection to MeetTeam
    const updateData: Record<string, unknown> = {
      selectedAthletes: JSON.stringify(data.athleteIds),
      testSpotAthleteIds: testSpotAthleteIds.length > 0 ? JSON.stringify(testSpotAthleteIds) : null,
      testSpotScoringAthleteId: testSpotAthleteIds.length > 0 ? testSpotScoringAthleteId : null,
      sensitivityAthleteId: sensitivityAthleteId ?? null,
      sensitivityPercent: sensitivityPercent ?? null,
      sensitivityVariant: sensitivityAthleteId != null ? ((meetTeam as { sensitivityVariant?: string | null }).sensitivityVariant ?? "baseline") : null,
    };
    if (sensitivityAthleteId == null) {
      updateData.sensitivityTotalScoreBetter = null;
      updateData.sensitivityTotalScoreWorse = null;
      updateData.sensitivityAthletePointsBaseline = null;
      updateData.sensitivityAthletePointsBetter = null;
      updateData.sensitivityAthletePointsWorse = null;
    }

    // #region agent log
    let clientSchemaHasSensitivity = false;
    try {
      const clientSchemaPath = path.join(process.cwd(), "node_modules", ".prisma", "client", "schema.prisma");
      const clientSchema = fs.readFileSync(clientSchemaPath, "utf-8");
      clientSchemaHasSensitivity = clientSchema.includes("sensitivityAthleteId");
    } catch {
      // ignore
    }
    DEBUG_LOG({
      location: "rosters/[teamId]/route.ts:before-update",
      message: "MeetTeam update payload and client state",
      hypothesisId: "H1",
      runId: "roster-save",
      data: {
        prismaClientPath: require.resolve("@prisma/client"),
        updatePayloadKeys: Object.keys(updateData),
        clientSchemaHasSensitivity,
      },
    });
    // #endregion

    if (!clientSchemaHasSensitivity && (sensitivityAthleteId != null || sensitivityPercent != null)) {
      return NextResponse.json(
        {
          error:
            "Prisma client is out of date. Stop the dev server, then run: npx prisma generate && npx prisma db push. Restart the dev server.",
          details: "Generated client does not include sensitivity fields. Regenerate with the server stopped.",
        },
        { status: 503 }
      );
    }

    try {
      const previousSensAthleteId = (meetTeam as { sensitivityAthleteId?: string | null }).sensitivityAthleteId ?? null;
      await prisma.meetTeam.update({
        where: {
          meetId_teamId: {
            meetId,
            teamId,
          },
        },
        data: updateData as Parameters<typeof prisma.meetTeam.update>[0]["data"],
      });
      if (sensitivityAthleteId == null && previousSensAthleteId) {
        await prisma.meetLineup.updateMany({
          where: { meetId, athleteId: previousSensAthleteId },
          data: {
            sensitivityPlaceBetter: null,
            sensitivityPointsBetter: null,
            sensitivityPlaceWorse: null,
            sensitivityPointsWorse: null,
          },
        });
      }
    } catch (updateError: any) {
      console.error("Error updating MeetTeam:", updateError);
      // #region agent log
      DEBUG_LOG({
        location: "rosters/[teamId]/route.ts:update-catch",
        message: "MeetTeam.update failed",
        hypothesisId: "H1",
        runId: "roster-save",
        data: { errorMessage: updateError?.message ?? String(updateError) },
      });
      // #endregion
      // If selectedAthletes field doesn't exist yet, try without it first
      if (updateError.message?.includes("Unknown argument") || updateError.message?.includes("selectedAthletes")) {
        return NextResponse.json(
          {
            error: "Prisma client is out of date. Stop the dev server, then run: npx prisma generate && npx prisma db push. Restart the dev server.",
            details: updateError.message,
          },
          { status: 500 }
        );
      }
      throw updateError;
    }

    // Enforce roster: only athletes in the current roster may have lineups or relay slots.
    // Remove from events and relays any athlete on this team who is NOT in data.athleteIds.
    const rosterIdSet = new Set(data.athleteIds);

    // Delete all meet lineups for this meet where the athlete is on this team but not on the roster
    const lineupsToDelete = await prisma.meetLineup.findMany({
      where: {
        meetId,
        athlete: { teamId },
      },
      select: { id: true, athleteId: true },
    });
    const idsToDelete = lineupsToDelete
      .filter((l) => !rosterIdSet.has(l.athleteId))
      .map((l) => l.id);
    if (idsToDelete.length > 0) {
      await prisma.meetLineup.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    }

    // Clear any relay member slot whose athlete is not on the roster
    const teamRelays = await prisma.relayEntry.findMany({
      where: { meetId, teamId },
    });
    for (const entry of teamRelays) {
      const members: (string | null)[] = entry.members
        ? (JSON.parse(entry.members) as (string | null)[])
        : [null, null, null, null];
      const legTimes: (string | null)[] = entry.legTimes
        ? (JSON.parse(entry.legTimes) as (string | null)[])
        : [null, null, null, null];
      const useRelaySplits: boolean[] = entry.useRelaySplits
        ? (JSON.parse(entry.useRelaySplits) as boolean[])
        : [false, true, true, true];
      let changed = false;
      const newMembers = members.map((id) => {
        if (id != null && !rosterIdSet.has(id)) {
          changed = true;
          return null;
        }
        return id;
      });
      if (changed) {
        await prisma.relayEntry.update({
          where: { id: entry.id },
          data: {
            members: JSON.stringify(newMembers),
            legTimes: JSON.stringify(legTimes),
            useRelaySplits: JSON.stringify(useRelaySplits),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Roster saved successfully",
      rosterCount: scoringRosterCount.toFixed(2),
      hasTestSpot: testSpotAthleteIds.length > 0,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error saving roster:", error);
    return NextResponse.json(
      { error: "Failed to save roster" },
      { status: 500 }
    );
  }
}
