import { notFound } from "next/navigation";
import { appendFileSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MeetAthleteSummaryTable } from "@/components/meets/meet-athlete-summary-table";
import { MeetNavigation } from "@/components/meets/meet-navigation";
import { BackToMeetButton } from "@/components/meets/back-to-meet-button";
import { sortEventsByOrder } from "@/lib/event-utils";

export default async function MeetAthletesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const meet = await prisma.meet.findUnique({
    where: { id },
    include: {
      meetTeams: {
        include: {
          team: { select: { id: true, name: true, schoolName: true, primaryColor: true } },
        },
      },
      meetLineups: {
        include: {
          athlete: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  schoolName: true,
                  primaryColor: true,
                },
              },
            },
          },
          event: true,
        },
      },
      relayEntries: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              primaryColor: true,
            },
          },
          event: true,
        },
      },
    },
  });

  if (!meet) {
    notFound();
  }

  // #region agent log
  const lineupAthleteIds = [...new Set(meet.meetLineups.map((l) => l.athleteId))];
  const h1Payload = { location: "athletes/page", message: "Athlete Summary: meetLineup athleteIds", data: { meetId: id, lineupAthleteCount: lineupAthleteIds.length, lineupAthleteIds }, timestamp: Date.now(), hypothesisId: "H1" };
  fetch('http://127.0.0.1:7242/ingest/426f4955-f215-4c12-ba39-c5cdc5ffe243',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(h1Payload)}).catch(()=>{});
  try { appendFileSync(join(process.cwd(), ".cursor", "debug.log"), JSON.stringify(h1Payload) + "\n"); } catch (_) {}
  // #endregion

  const individualScoring = meet.individualScoring
    ? (JSON.parse(meet.individualScoring) as Record<string, number>)
    : {};
  const relayScoring = meet.relayScoring
    ? (JSON.parse(meet.relayScoring) as Record<string, number>)
    : {};

  const selectedEventIds = meet.selectedEvents
    ? (JSON.parse(meet.selectedEvents) as string[])
    : [];
  const eventOrder = meet.eventOrder
    ? (JSON.parse(meet.eventOrder) as string[])
    : null;
  const eventsUnsorted = await prisma.event.findMany({
    where: { id: { in: selectedEventIds } },
  });
  const events = sortEventsByOrder(eventsUnsorted, eventOrder);

  const testSpotAthleteIds: string[] = [];
  meet.meetTeams?.forEach((mt) => {
    if (mt.testSpotAthleteIds) {
      try {
        const ids = JSON.parse(mt.testSpotAthleteIds) as string[];
        testSpotAthleteIds.push(...ids);
      } catch (_) {}
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Athlete Summary</h1>
          <p className="text-slate-600 mt-1">{meet.name}</p>
        </div>
        <BackToMeetButton meetId={id} />
      </div>

      {/* Navigation */}
      <MeetNavigation meetId={id} status={meet.status} />

      {/* Athlete Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Athlete Summary</CardTitle>
          <CardDescription>
            Overview of all athletes competing in this meet, including events and projected points
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MeetAthleteSummaryTable
            meetLineups={meet.meetLineups}
            relayEntries={meet.relayEntries}
            events={events}
            individualScoring={individualScoring}
            relayScoring={relayScoring}
            scoringPlaces={meet.scoringPlaces}
            testSpotAthleteIds={testSpotAthleteIds}
            meetId={id}
            meetTeams={meet.meetTeams.map((mt) => ({
              teamId: mt.teamId,
              sensitivityVariantAthleteId: (mt as { sensitivityVariantAthleteId?: string | null }).sensitivityVariantAthleteId,
              sensitivityVariant: (mt as { sensitivityVariant?: string | null }).sensitivityVariant,
              sensitivityPercent: (mt as { sensitivityPercent?: number | null }).sensitivityPercent,
              team: mt.team,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
