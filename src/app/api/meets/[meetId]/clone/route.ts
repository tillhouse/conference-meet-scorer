import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function buildClonedMeetName(sourceName: string): Promise<string> {
  const baseCopyName = `${sourceName} (Copy)`;
  const existing = await prisma.meet.findMany({
    where: {
      OR: [{ name: baseCopyName }, { name: { startsWith: `${baseCopyName} ` } }],
    },
    select: { name: true },
  });

  const usedNames = new Set(existing.map((m) => m.name));
  if (!usedNames.has(baseCopyName)) return baseCopyName;

  let n = 2;
  while (usedNames.has(`${baseCopyName} ${n}`)) n += 1;
  return `${baseCopyName} ${n}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string }> }
) {
  try {
    const { meetId } = await params;
    void request;

    const source = await prisma.meet.findUnique({
      where: { id: meetId },
      include: {
        meetTeams: true,
        meetLineups: true,
        relayEntries: true,
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Meet not found" }, { status: 404 });
    }

    const clonedName = await buildClonedMeetName(source.name);

    const created = await prisma.$transaction(async (tx) => {
      const clonedMeet = await tx.meet.create({
        data: {
          name: clonedName,
          date: source.date,
          location: source.location,
          durationDays: source.durationDays,
          conferenceId: source.conferenceId,
          teamId: source.teamId,
          teamAccountId: source.teamAccountId,
          status: "draft",
          meetType: source.meetType,
          maxAthletes: source.maxAthletes,
          diverRatio: source.diverRatio,
          divingIncluded: source.divingIncluded,
          maxIndivEvents: source.maxIndivEvents,
          maxRelays: source.maxRelays,
          maxDivingEvents: source.maxDivingEvents,
          scoringType: source.scoringType,
          scoringPlaces: source.scoringPlaces,
          scoringStartPoints: source.scoringStartPoints,
          relayMultiplier: source.relayMultiplier,
          individualScoring: source.individualScoring,
          relayScoring: source.relayScoring,
          divingScoring: source.divingScoring,
          selectedEvents: source.selectedEvents,
          eventOrder: source.eventOrder,
          eventDays: source.eventDays,
          scoringMode: source.scoringMode,
          realResultsEventIds: source.realResultsEventIds,
        },
      });

      if (source.meetTeams.length > 0) {
        await tx.meetTeam.createMany({
          data: source.meetTeams.map((mt) => ({
            meetId: clonedMeet.id,
            teamId: mt.teamId,
            selectedAthletes: mt.selectedAthletes,
            testSpotAthleteIds: mt.testSpotAthleteIds,
            testSpotScoringAthleteId: mt.testSpotScoringAthleteId,
            exhibitionAthleteIds: mt.exhibitionAthleteIds,
            sensitivityAthleteIds: mt.sensitivityAthleteIds,
            sensitivityPercent: mt.sensitivityPercent,
            sensitivityVariant: mt.sensitivityVariant,
            sensitivityVariantAthleteId: mt.sensitivityVariantAthleteId,
            sensitivityResults: mt.sensitivityResults,
            individualScore: mt.individualScore,
            relayScore: mt.relayScore,
            divingScore: mt.divingScore,
            totalScore: mt.totalScore,
            simulatedIndividualScore: mt.simulatedIndividualScore,
            simulatedRelayScore: mt.simulatedRelayScore,
            simulatedDivingScore: mt.simulatedDivingScore,
            simulatedTotalScore: mt.simulatedTotalScore,
          })),
        });
      }

      if (source.meetLineups.length > 0) {
        await tx.meetLineup.createMany({
          data: source.meetLineups.map((lineup) => ({
            meetId: clonedMeet.id,
            athleteId: lineup.athleteId,
            eventId: lineup.eventId,
            seedTime: lineup.seedTime,
            seedTimeSeconds: lineup.seedTimeSeconds,
            overrideTime: lineup.overrideTime,
            overrideTimeSeconds: lineup.overrideTimeSeconds,
            finalTime: lineup.finalTime,
            finalTimeSeconds: lineup.finalTimeSeconds,
            place: lineup.place,
            points: lineup.points,
            realResultApplied: lineup.realResultApplied,
            simulatedPlace: lineup.simulatedPlace,
            simulatedPoints: lineup.simulatedPoints,
            simulatedTime: lineup.simulatedTime,
            simulatedTimeSeconds: lineup.simulatedTimeSeconds,
            sensitivityPlaceBetter: lineup.sensitivityPlaceBetter,
            sensitivityPointsBetter: lineup.sensitivityPointsBetter,
            sensitivityPlaceWorse: lineup.sensitivityPlaceWorse,
            sensitivityPointsWorse: lineup.sensitivityPointsWorse,
            splitsData: lineup.splitsData,
          })),
        });
      }

      if (source.relayEntries.length > 0) {
        await tx.relayEntry.createMany({
          data: source.relayEntries.map((relay) => ({
            meetId: clonedMeet.id,
            teamId: relay.teamId,
            eventId: relay.eventId,
            seedTime: relay.seedTime,
            seedTimeSeconds: relay.seedTimeSeconds,
            overrideTime: relay.overrideTime,
            overrideTimeSeconds: relay.overrideTimeSeconds,
            finalTime: relay.finalTime,
            finalTimeSeconds: relay.finalTimeSeconds,
            place: relay.place,
            points: relay.points,
            realResultApplied: relay.realResultApplied,
            simulatedPlace: relay.simulatedPlace,
            simulatedPoints: relay.simulatedPoints,
            simulatedTime: relay.simulatedTime,
            simulatedTimeSeconds: relay.simulatedTimeSeconds,
            members: relay.members,
            legTimes: relay.legTimes,
            useRelaySplits: relay.useRelaySplits,
            splitsData: relay.splitsData,
          })),
        });
      }

      return clonedMeet;
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    console.error("Error cloning meet:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clone meet" },
      { status: 500 }
    );
  }
}
